import { SharedServices } from '../shared';
import { PreviewManager } from './PreviewManager';
import { TimelineManager } from './TimelineManager';
import { PlaybackManager } from './PlaybackManager';
import type { 
  RecordingUIState, 
  RecordingUIConfig, 
  ConnectionStatus,
  RecordingEventType,
  RecordingMode,
  RecordingEvent,
  RecordingStats,
  RecordingWebSocketMessage,
  TimelineItem
} from '../shared/types/recording';
import { 
  DEFAULT_RECORDING_CONFIG,
  DEFAULT_SELECTED_EVENTS,
  ALL_RECORDING_EVENTS,
  STATUS_MESSAGES,
  RECORDING_LIMITS
} from '../shared/constants/recording';
import { 
  formatDuration, 
  formatTimestamp, 
  eventsToTimelineItems,
  getEventIcon,
  getEventColor,
  debounce,
  throttle,
  truncateUrl,
  truncateText,
  truncateSelector
} from '../shared/utils/recording';
import { ValidationService } from '../shared/utils/validation';
import { SessionSyncService } from '../shared/services/SessionSyncService';

export class RecordingManager {
  private sharedServices: SharedServices;
  private uiState: RecordingUIState;
  private uiConfig: RecordingUIConfig;
  private connectionStatus: ConnectionStatus;
  private recordingTimer: number | null = null;
  private statusCheckInterval: number | null = null;
  private currentSessionId: string | null = null;
  private capturedEvents: RecordingEvent[] = [];
  private timelineItems: TimelineItem[] = [];
  public previewManager: PreviewManager;
  public timelineManager: TimelineManager;
  public playbackManager: PlaybackManager;
  public sessionSyncService: SessionSyncService;
  private debouncedUpdateUI: () => void;
  private throttledUpdateCounters: () => void;

  constructor(sharedServices: SharedServices) {
    this.sharedServices = sharedServices;
    
    // Criar versões debounced/throttled dos métodos
    this.debouncedUpdateUI = debounce(() => this.updateRecordingUI(), 100);
    this.throttledUpdateCounters = throttle(() => this.updateActionsCount(), 200);
    
    // Inicializar estado da UI
    this.uiState = {
      isRecording: false,
      isPaused: false,
      elapsedTime: 0,
      eventCount: 0,
      currentStatus: 'idle',
    };

    // Inicializar configuração da UI
    this.uiConfig = { ...DEFAULT_RECORDING_CONFIG };

    // Inicializar status de conexão
    this.connectionStatus = {
      chrome: { connected: false },
      playground: { configured: false },
      websocket: { connected: false }
    };

    // Inicializar PreviewManager
    this.previewManager = new PreviewManager(this.sharedServices);
    
    // Inicializar TimelineManager
    this.timelineManager = new TimelineManager(this.sharedServices);
    
    // Inicializar PlaybackManager
    this.playbackManager = new PlaybackManager(this.sharedServices);
    
    // Inicializar SessionSyncService
    this.sessionSyncService = new SessionSyncService(this.sharedServices);
  }

  public init(): void {
    this.setupEventListeners();
    this.checkConnectionStatus();
    this.initializeUI();
    this.loadUIConfiguration();
    this.previewManager.init();
    this.timelineManager.init();
    this.playbackManager.init();
    this.setupTimelineCallback();
    this.setupKeyboardShortcuts();
    this.setupSessionSync();
  }

  /**
   * Configurar atalhos de teclado
   */
  private setupKeyboardShortcuts(): void {
    if (!window.keyboardManager) return;

    // Atalhos de gravação
    window.keyboardManager.register({
      key: 'r',
      ctrlKey: true,
      action: () => this.startRecording(),
      description: 'Iniciar gravação',
      enabled: () => !this.uiState.isRecording
    });

    window.keyboardManager.register({
      key: ' ',
      action: () => {
        if (this.uiState.isRecording) {
          this.pauseRecording();
        }
      },
      description: 'Pausar/resumir gravação',
      enabled: () => this.uiState.isRecording
    });

    window.keyboardManager.register({
      key: 's',
      ctrlKey: true,
      action: () => this.stopRecording(),
      description: 'Parar gravação',
      enabled: () => this.uiState.isRecording
    });

    // Atalhos de timeline
    window.keyboardManager.register({
      key: 'p',
      ctrlKey: true,
      action: () => this.playTimeline(),
      description: 'Reproduzir timeline',
      enabled: () => this.capturedEvents.length > 0
    });

    // Atalhos de exportação
    window.keyboardManager.register({
      key: 'e',
      ctrlKey: true,
      action: () => this.exportActions(),
      description: 'Exportar gravação',
      enabled: () => !this.uiState.isRecording && this.uiState.eventCount > 0
    });

    // Atalhos de importação
    window.keyboardManager.register({
      key: 'i',
      ctrlKey: true,
      action: () => this.playbackManager.showImportModal(),
      description: 'Importar gravação',
      enabled: () => true // Sempre habilitado, criará sessão se necessário
    });

    // Atalho para limpar ações
    window.keyboardManager.register({
      key: 'Delete',
      ctrlKey: true,
      action: () => this.clearActions(),
      description: 'Limpar ações',
      enabled: () => !this.uiState.isRecording && this.uiState.eventCount > 0
    });

    // Atalho para capturar screenshot
    window.keyboardManager.register({
      key: 'F12',
      action: () => this.takePreviewScreenshot(),
      description: 'Capturar screenshot',
      enabled: () => true // Sempre habilitado, criará sessão se necessário
    });

    // Atalho para mostrar ajuda
    window.keyboardManager.register({
      key: 'F1',
      action: () => window.keyboardManager?.showHelp(),
      description: 'Mostrar ajuda de atalhos'
    });
  }

  /**
   * Configurar sincronização de sessão
   */
  private setupSessionSync(): void {
    // Configurar callback para mudanças de sessão (apenas de outras páginas)
    this.sessionSyncService.onSessionChange((sessionInfo) => {
      if (sessionInfo && sessionInfo.sessionId !== this.currentSessionId) {
        console.log('🔄 Sessão detectada via sync:', sessionInfo.sessionId);
        this.setActiveSessionInternal(sessionInfo.sessionId); // Usar método interno para evitar loop
      } else if (!sessionInfo && this.currentSessionId) {
        console.log('🔌 Sessão removida via sync');
        this.clearActiveSessionInternal(); // Usar método interno para evitar loop
      }
    });

    // Verificar se há sessão ativa ao inicializar (apenas uma vez)
    this.checkForActiveSession();
  }

  /**
   * Verificar se há sessão ativa ao carregar a página
   */
  private async checkForActiveSession(): Promise<void> {
    try {
      console.log('🔍 Verificando sessão ativa...');
      
      const sessionInfo = await this.sessionSyncService.getActiveSession();
      
      if (sessionInfo) {
        console.log('✅ Sessão ativa encontrada:', sessionInfo.sessionId);
        this.setActiveSessionInternal(sessionInfo.sessionId); // Usar método interno para evitar loop
        
        if (window.notificationManager) {
          window.notificationManager.success(
            'Sessão restaurada',
            `Conectado à sessão: ${sessionInfo.sessionId.substring(0, 8)}...`
          );
        }
      } else {
        console.log('ℹ️ Nenhuma sessão ativa encontrada');
        this.updateConnectionStatus();
      }
    } catch (error: any) {
      console.error('❌ Erro ao verificar sessão ativa:', error);
      this.clearActiveSessionInternal(); // Usar método interno para evitar loop
    }
  }

  /**
   * Configurar callback da timeline para sincronizar com preview
   */
  private setupTimelineCallback(): void {
    this.timelineManager.setEventPlaybackCallback((event: RecordingEvent, index: number) => {
      console.log(`🎬 Timeline reproduzindo evento ${index + 1}: ${event.type}`);
      
      // Aqui poderia sincronizar com preview, destacar elementos, etc.
      // Por enquanto, apenas log
    });
  }

  /**
   * Carregar configurações da UI dos elementos HTML
   */
  private loadUIConfiguration(): void {
    // Carregar eventos selecionados
    const eventCheckboxes = document.querySelectorAll('input[data-event]') as NodeListOf<HTMLInputElement>;
    const selectedEvents = new Set<RecordingEventType>();
    
    eventCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        selectedEvents.add(checkbox.dataset.event as RecordingEventType);
      }
    });
    
    this.uiConfig.selectedEvents = selectedEvents;

    // Carregar modo de gravação
    const modeSelect = document.getElementById('recordingMode') as HTMLSelectElement;
    if (modeSelect) {
      this.uiConfig.mode = modeSelect.value as RecordingMode;
    }

    // Carregar delay
    const delayInput = document.getElementById('recordingDelay') as HTMLInputElement;
    if (delayInput) {
      this.uiConfig.delay = parseInt(delayInput.value) || 500;
    }
  }

  /**
   * Validar se a sessão atual ainda é válida no backend
   */
  private async validateCurrentSession(): Promise<boolean> {
    if (!this.currentSessionId) {
      return false;
    }

    try {
      // Usar o endpoint específico de validação de sessão
      const result = await this.sharedServices.apiService.validateSession(this.currentSessionId);
      
      if (result.success && result.valid) {
        console.log('✅ Sessão validada com sucesso');
        return true;
      } else {
        console.warn('⚠️ Sessão não é mais válida:', result.error);
        
        // Limpar sessão inválida
        this.currentSessionId = null;
        if (this.sessionSyncService) {
          this.sessionSyncService.clearStoredSession();
        }
        return false;
      }
    } catch (error: any) {
      console.warn('⚠️ Erro ao validar sessão:', error.message);
      
      // Se erro indica sessão expirada, limpar sessão atual
      if (error.message?.includes('Sessão não encontrada') || 
          error.message?.includes('sessionExpired') ||
          error.message?.includes('Sessão foi fechada')) {
        
        // Limpar sessão inválida
        this.currentSessionId = null;
        if (this.sessionSyncService) {
          this.sessionSyncService.clearStoredSession();
        }
      }
      
      return false;
    }
  }

  /**
   * Criar nova sessão automaticamente
   */
  private async createNewSession(): Promise<void> {
    try {
      console.log('🚀 Criando nova sessão automaticamente...');
      
      // Usar configuração padrão para criar sessão
      const defaultConfig = {
        browserWSEndpoint: '', // Será detectado automaticamente pelo backend
        headless: false,
        devtools: true
      };

      const result = await this.sharedServices.apiService.createSession(defaultConfig);
      
      // Definir sessão ativa
      this.setActiveSession(result.sessionId);
      
      console.log(`✅ Nova sessão criada: ${result.sessionId}`);
      
      if (window.notificationManager) {
        window.notificationManager.success(
          'Sessão criada automaticamente', 
          `Nova sessão: ${result.sessionId.substring(0, 8)}...`
        );
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao criar sessão automaticamente:', error);
      throw new Error(`Erro ao criar sessão: ${error.message}`);
    }
  }

  /**
   * Obter configuração atual para enviar ao backend
   */
  private getRecordingConfig(): Partial<import('../shared/types/recording').RecordingConfig> {
    return {
      events: Array.from(this.uiConfig.selectedEvents),
      mode: this.uiConfig.mode,
      delay: this.uiConfig.delay,
      captureScreenshots: this.uiConfig.autoScreenshot,
      screenshotInterval: this.uiConfig.screenshotInterval,
      maxEvents: RECORDING_LIMITS.MAX_EVENTS,
      maxDuration: RECORDING_LIMITS.MAX_DURATION
    };
  }

  private setupEventListeners(): void {
    // Botões de controle de gravação
    document.getElementById('startRecordingBtn')?.addEventListener('click', () => this.startRecording());
    document.getElementById('pauseRecordingBtn')?.addEventListener('click', () => this.pauseRecording());
    document.getElementById('stopRecordingBtn')?.addEventListener('click', () => this.stopRecording());

    // Botões de seção
    document.getElementById('toggleRecordingConfigSection')?.addEventListener('click', () => this.toggleSection('recordingConfig'));
    document.getElementById('toggleRecordingExecutionSection')?.addEventListener('click', () => this.toggleSection('recordingExecution'));

    // Botões de ações
    document.getElementById('clearActionsBtn')?.addEventListener('click', () => this.clearActions());
    document.getElementById('exportActionsBtn')?.addEventListener('click', () => this.exportActions());
    document.getElementById('refreshPreviewBtn')?.addEventListener('click', () => this.refreshPreview());

    // Timeline controls
    document.getElementById('playTimelineBtn')?.addEventListener('click', () => this.playTimeline());
    document.getElementById('pauseTimelineBtn')?.addEventListener('click', () => this.pauseTimeline());
    document.getElementById('stopTimelineBtn')?.addEventListener('click', () => this.stopTimeline());

    // Preview controls
    document.getElementById('takePreviewScreenshot')?.addEventListener('click', () => this.takePreviewScreenshot());
    document.getElementById('fullscreenPreview')?.addEventListener('click', () => this.toggleFullscreenPreview());
  }

  private async checkConnectionStatus(): Promise<void> {
    // Verificar Chrome
    try {
      await this.sharedServices.apiService.checkChromeStatus();
      this.connectionStatus.chrome.connected = true;
      this.connectionStatus.chrome.error = undefined;
    } catch (error: any) {
      this.connectionStatus.chrome.connected = false;
      this.connectionStatus.chrome.error = error.message;
    }

    // Verificar WebSocket (assumindo que está conectado se chegou até aqui)
    this.connectionStatus.websocket.connected = true;

    // Atualizar UI
    this.updateConnectionStatus();
  }

  /**
   * Atualizar status de conexão na UI
   */
  private updateConnectionStatus(): void {
    const chromeStatusIcon = document.getElementById('recordingChromeStatus');
    const chromeStatusText = document.getElementById('recordingChromeStatusText');
    const playgroundStatusIcon = document.getElementById('recordingPlaygroundStatus');
    const playgroundStatusText = document.getElementById('recordingPlaygroundStatusText');

    // Status do Chrome
    if (this.connectionStatus.chrome.connected) {
      this.updateStatusIndicator(chromeStatusIcon, chromeStatusText, 'success', 'Chrome conectado e disponível');
    } else {
      this.updateStatusIndicator(chromeStatusIcon, chromeStatusText, 'error', 
        `Chrome não disponível: ${this.connectionStatus.chrome.error || 'Erro desconhecido'}`);
    }

    // Status do Playground
    if (this.connectionStatus.playground.configured) {
      const shortId = this.connectionStatus.playground.sessionId?.substring(0, 8) || 'unknown';
      this.updateStatusIndicator(playgroundStatusIcon, playgroundStatusText, 'success', 
        `Sessão ativa: ${shortId}... (clique para ver detalhes)`);
      
      // Adicionar click handler para mostrar detalhes
      if (playgroundStatusText) {
        playgroundStatusText.style.cursor = 'pointer';
        playgroundStatusText.onclick = () => {
          if (window.notificationManager && this.connectionStatus.playground.sessionId) {
            window.notificationManager.info(
              'Detalhes da Sessão',
              `ID completo: ${this.connectionStatus.playground.sessionId}<br>Status: Ativa<br>Página: Gravação`
            );
          }
        };
      }
    } else {
      this.updateStatusIndicator(playgroundStatusIcon, playgroundStatusText, 'info', 
        'Sessão será criada automaticamente ao iniciar gravação');
      
      // Remover click handler se existir
      if (playgroundStatusText) {
        playgroundStatusText.style.cursor = 'default';
        playgroundStatusText.onclick = null;
      }
    }
  }

  private updateStatusIndicator(iconElement: HTMLElement | null, textElement: HTMLElement | null, status: 'success' | 'error' | 'warning' | 'info', message: string): void {
    if (!iconElement || !textElement) return;

    // Verificar se é SVG (não tem className property)
    if (iconElement.tagName === 'svg' || iconElement instanceof SVGElement) {
      iconElement.setAttribute('class', `status-icon ${status}`);
    } else {
    iconElement.className = `status-icon ${status}`;
    }
    
    textElement.textContent = message;

    // Atualizar classes CSS para cores (remover e adicionar)
    iconElement.classList.remove('success', 'error', 'warning', 'info');
    iconElement.classList.add(status);
  }

  private initializeUI(): void {
    this.updateRecordingUI();
    this.updateActionsCount();
    this.updateButtonStates();
  }

  private async startRecording(): Promise<void> {
    if (this.uiState.isRecording) return;

    try {
      // Verificar se há sessão ativa, se não houver, criar uma
      if (!this.currentSessionId) {
        console.log('🔄 Nenhuma sessão ativa, criando nova sessão...');
        await this.createNewSession();
        
        if (!this.currentSessionId) {
          throw new Error('Não foi possível criar uma nova sessão');
        }
      }

      // Validar se a sessão ainda é válida no backend antes de tentar gravar
      console.log('🔍 Validando sessão antes de iniciar gravação...');
      const isSessionValid = await this.validateCurrentSession();
      
      if (!isSessionValid) {
        console.log('⚠️ Sessão inválida detectada, criando nova sessão...');
        await this.createNewSession();
        
        if (!this.currentSessionId) {
          throw new Error('Não foi possível criar uma nova sessão após validação');
        }
      }

      // Verificar se já existe uma gravação ativa para esta sessão
      console.log('🔍 Verificando se há gravação ativa...');
      const hasActiveRecording = await this.sharedServices.apiService.hasActiveRecording(this.currentSessionId);
      
      if (hasActiveRecording) {
        console.log('⚠️ Já existe uma gravação ativa para esta sessão');
        throw new Error('Já existe uma gravação ativa para esta sessão. Pare a gravação atual antes de iniciar uma nova.');
      }

      // Carregar configurações atuais da UI
      this.loadUIConfiguration();

      // Validar configuração
      const configValidation = ValidationService.validateRecordingConfig(this.getRecordingConfig());
      if (!configValidation.isValid) {
        ValidationService.showValidationResult(configValidation, 'Configuração de Gravação');
        throw new Error(configValidation.errors[0]);
      }

      // Mostrar warnings se houver
      if (configValidation.warnings.length > 0) {
        ValidationService.showValidationResult(configValidation, 'Configuração de Gravação');
      }

      // Iniciar gravação via API
      console.log('🔴 Iniciando gravação...');
      const response = await this.sharedServices.apiService.startRecording(
        this.currentSessionId,
        this.getRecordingConfig()
      );

      // Atualizar estado
      this.uiState.isRecording = true;
      this.uiState.isPaused = false;
      this.uiState.recordingId = response.recordingId;
      this.uiState.sessionId = response.sessionId;
      this.uiState.startTime = new Date();
      this.uiState.currentStatus = 'recording';
      this.uiState.error = undefined;

      // Iniciar timers
    this.startRecordingTimer();
      this.startStatusPolling();

      // Atualizar UI
    this.updateRecordingUI();
      this.updateButtonStates();

      console.log(`✅ Gravação iniciada: ${response.recordingId}`);
      this.showSuccess('Gravação iniciada', `ID: ${response.recordingId}`);

    } catch (error: any) {
      console.error('❌ Erro ao iniciar gravação:', error);
      
      // Mensagem de erro mais específica para problemas de sessão
      let errorMessage = error.message;
      if (error.message?.includes('Sessão não encontrada') || 
          error.message?.includes('sessionExpired')) {
        errorMessage = 'Sessão expirou. Tente novamente - uma nova sessão será criada automaticamente.';
      } else if (error.message?.includes('Não foi possível criar uma nova sessão')) {
        errorMessage = 'Erro ao criar sessão. Verifique se o Chrome está rodando com debug habilitado.';
      }
      
      // Reset completo do estado da UI
      this.resetRecordingState();
      this.uiState.error = errorMessage;
      this.uiState.currentStatus = 'error';
      this.updateRecordingUI();
      this.updateButtonStates();
      this.showError('Erro ao iniciar gravação', errorMessage);
    }
  }

  private async pauseRecording(): Promise<void> {
    if (!this.uiState.isRecording || !this.uiState.recordingId) return;

    try {
      console.log('⏸️ Pausando/resumindo gravação...');
      
      const response = await this.sharedServices.apiService.pauseRecording(this.uiState.recordingId);
      
      // Atualizar estado baseado na resposta
      this.uiState.isPaused = response.status === 'paused';
      this.uiState.currentStatus = response.status;
      
      if (this.uiState.isPaused) {
    this.stopRecordingTimer();
      } else {
        this.startRecordingTimer();
      }

    this.updateRecordingUI();
      this.updateButtonStates();

      console.log(`${this.uiState.isPaused ? '⏸️' : '▶️'} ${response.message}`);

    } catch (error: any) {
      console.error('❌ Erro ao pausar/resumir gravação:', error);
      this.showError('Erro ao pausar gravação', error.message);
    }
  }

  private async stopRecording(): Promise<void> {
    if (!this.uiState.isRecording || !this.uiState.recordingId) return;

    try {
      console.log('⏹️ Parando gravação...');
      
      const response = await this.sharedServices.apiService.stopRecording(this.uiState.recordingId);
      
      // Reset do estado da gravação
      this.resetRecordingState();
      this.uiState.currentStatus = 'stopped';
      this.uiState.eventCount = response.stats.totalEvents;

      // Atualizar UI
    this.updateRecordingUI();
      this.updateButtonStates();
      this.displayRecordingStats(response.stats);

      console.log(`✅ Gravação finalizada: ${response.stats.totalEvents} eventos capturados`);
      this.showSuccess('Gravação finalizada', `${response.stats.totalEvents} eventos capturados`);

    } catch (error: any) {
      console.error('❌ Erro ao parar gravação:', error);
      this.showError('Erro ao parar gravação', error.message);
    }
  }

  private startRecordingTimer(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
    }
    
    this.recordingTimer = window.setInterval(() => {
      this.updateRecordingTime();
    }, 1000);
  }

  /**
   * Iniciar polling de status da gravação
   */
  private startStatusPolling(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    this.statusCheckInterval = window.setInterval(async () => {
      if (this.uiState.isRecording && this.currentSessionId) {
        try {
          const status = await this.sharedServices.apiService.getRecordingStatus(this.currentSessionId);
          this.updateFromStatusResponse(status);
        } catch (error) {
          console.error('Erro ao verificar status da gravação:', error);
        }
      }
    }, 2000); // Verificar a cada 2 segundos
  }

  /**
   * Parar polling de status
   */
  private stopStatusPolling(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  /**
   * Atualizar estado baseado na resposta de status
   */
  private updateFromStatusResponse(status: any): void {
    this.uiState.eventCount = status.stats.totalEvents;
    this.uiState.currentStatus = status.status;
    
    // Atualizar contadores na UI
    this.updateActionsCount();
    
    // Se a gravação foi parada externamente
    if (!status.isActive && this.uiState.isRecording) {
      this.uiState.isRecording = false;
      this.uiState.isPaused = false;
      this.stopRecordingTimer();
      this.stopStatusPolling();
      this.updateRecordingUI();
      this.updateButtonStates();
    }
  }

  private stopRecordingTimer(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  private updateRecordingTime(): void {
    if (!this.uiState.startTime) return;

    const elapsed = Date.now() - this.uiState.startTime.getTime();
    this.uiState.elapsedTime = elapsed;

    const formattedTime = formatDuration(elapsed);

    const timerElement = document.getElementById('recordingTimer');
    if (timerElement) {
      timerElement.textContent = formattedTime;
    }

    const durationElement = document.getElementById('recordingDuration');
    if (durationElement) {
      durationElement.textContent = formattedTime;
    }
  }

  private updateRecordingUI(): void {
    const startBtn = document.getElementById('startRecordingBtn') as HTMLButtonElement;
    const statusContainer = document.getElementById('recordingStatusContainer');
    const recordingInfo = document.getElementById('recordingInfo');
    const statusText = document.getElementById('recordingStatusText');
    const statusBadge = document.getElementById('recordingStatusBadge');
    const actionsCount = document.getElementById('actionsCount');
    const duration = document.getElementById('recordingDuration');

    if (this.uiState.isRecording) {
      if (startBtn) startBtn.style.display = 'none';
      if (statusContainer) statusContainer.style.display = 'block';
      if (recordingInfo) recordingInfo.style.display = 'block';
    } else {
      if (startBtn) {
        startBtn.style.display = 'block';
        startBtn.disabled = false; // Sempre habilitado quando não está gravando
      }
      if (statusContainer) statusContainer.style.display = 'none';
      // Sempre esconder recordingInfo quando não está gravando, independente de startTime
      if (recordingInfo && this.uiState.currentStatus !== 'recording') {
        recordingInfo.style.display = 'none';
      }
    }

    // Atualizar texto de status e badge
    if (statusText && statusBadge) {
      let statusMessage = 'Pronto';
      let badgeClass = '';
      
      if (this.uiState.currentStatus === 'recording') {
        statusMessage = this.uiState.isPaused ? 'Pausado' : 'Gravando...';
        badgeClass = this.uiState.isPaused ? 'paused' : 'recording';
      } else if (this.uiState.currentStatus === 'stopped') {
        statusMessage = 'Finalizada';
        badgeClass = 'completed';
      } else if (this.uiState.currentStatus === 'error') {
        statusMessage = 'Erro';
        badgeClass = 'error';
      }
      
      statusText.textContent = statusMessage;
      
      // Atualizar classes do badge
      statusBadge.className = 'recording-info-badge';
      if (badgeClass) {
        statusBadge.classList.add(badgeClass);
      }
    }

    // Atualizar contadores
    if (actionsCount) {
      actionsCount.textContent = this.uiState.eventCount.toString();
    }
    
    if (duration) {
      duration.textContent = formatDuration(this.uiState.elapsedTime);
    }
  }

  /**
   * Atualizar estados dos botões
   */
  private updateButtonStates(): void {
    const startBtn = document.getElementById('startRecordingBtn') as HTMLButtonElement;
    const pauseBtn = document.getElementById('pauseRecordingBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopRecordingBtn') as HTMLButtonElement;
    const clearBtn = document.getElementById('clearActionsBtn') as HTMLButtonElement;
    const exportBtn = document.getElementById('exportActionsBtn') as HTMLButtonElement;

    if (startBtn) {
      // Botão sempre habilitado quando não está gravando (criará sessão automaticamente se necessário)
      startBtn.disabled = this.uiState.isRecording;
    }

    if (pauseBtn) {
      pauseBtn.disabled = !this.uiState.isRecording;
      const icon = pauseBtn.querySelector('i');
      const text = pauseBtn.querySelector('span') || pauseBtn;
      
      if (this.uiState.isPaused) {
        icon?.setAttribute('data-lucide', 'play');
        if (text) text.textContent = 'Resumir';
      } else {
        icon?.setAttribute('data-lucide', 'pause');
        if (text) text.textContent = 'Pausar';
      }
    }

    if (stopBtn) {
      stopBtn.disabled = !this.uiState.isRecording;
    }

    if (clearBtn) {
      clearBtn.disabled = this.uiState.isRecording || this.uiState.eventCount === 0;
    }

    if (exportBtn) {
      exportBtn.disabled = this.uiState.isRecording || this.uiState.eventCount === 0;
    }

    // Reinicializar ícones Lucide
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  }

  private updateActionsCount(): void {
    const actionsCountElement = document.getElementById('actionsCount');
    const totalActionsCountElement = document.getElementById('totalActionsCount');
    const lastActionTimeElement = document.getElementById('lastActionTime');

    if (actionsCountElement) {
      actionsCountElement.textContent = this.uiState.eventCount.toString();
    }
    if (totalActionsCountElement) {
      totalActionsCountElement.textContent = this.uiState.eventCount.toString();
    }
    if (lastActionTimeElement && this.uiState.lastEventTime) {
      lastActionTimeElement.textContent = formatTimestamp(this.uiState.lastEventTime.getTime());
    }
  }

  /**
   * Resetar completamente o estado da gravação
   */
  private resetRecordingState(): void {
    console.log('🔄 Resetando estado da gravação...');
    
    // Parar timers se estiverem rodando
    this.stopRecordingTimer();
    this.stopStatusPolling();
    
    // Reset do estado
    this.uiState.isRecording = false;
    this.uiState.isPaused = false;
    this.uiState.recordingId = undefined;
    this.uiState.startTime = undefined;
    this.uiState.elapsedTime = 0;
    this.uiState.lastEventTime = undefined;
    this.uiState.currentStatus = 'idle';
    this.uiState.error = undefined;
  }

  /**
   * Exibir estatísticas da gravação
   */
  private displayRecordingStats(stats: RecordingStats): void {
    console.log('📊 Estatísticas da gravação:', stats);
    
    // Atualizar contadores
    this.updateActionsCount();
    
    // Mostrar resumo no console
    console.log(`📈 Total de eventos: ${stats.totalEvents}`);
    console.log(`⏱️ Duração: ${formatDuration(stats.duration)}`);
    console.log(`📸 Screenshots: ${stats.screenshotCount}`);
    console.log(`📊 Eventos por tipo:`, stats.eventsByType);
  }

  /**
   * Exibir erro na UI
   */
  private showError(title: string, message: string): void {
    console.error(`${title}: ${message}`);
    
    if (window.notificationManager) {
      window.notificationManager.error(title, message);
    } else {
      alert(`${title}\n\n${message}`);
    }
  }

  /**
   * Exibir sucesso na UI
   */
  private showSuccess(title: string, message: string): void {
    console.log(`${title}: ${message}`);
    
    if (window.notificationManager) {
      window.notificationManager.success(title, message);
    }
  }

  /**
   * Exibir informação na UI
   */
  private showInfo(title: string, message: string): void {
    console.log(`${title}: ${message}`);
    
    if (window.notificationManager) {
      window.notificationManager.info(title, message);
    }
  }

  /**
   * Definir sessão ativa (público - com sincronização)
   */
  public setActiveSession(sessionId: string): void {
    this.setActiveSessionInternal(sessionId);
    
    // Armazenar sessão no localStorage para sincronização
    this.sessionSyncService.storeSession({
      sessionId,
      createdAt: Date.now(),
      lastUsed: Date.now()
    });
  }

  /**
   * Definir sessão ativa (interno - sem sincronização)
   */
  private setActiveSessionInternal(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.connectionStatus.playground.configured = true;
    this.connectionStatus.playground.sessionId = sessionId;
    
    // Ativar preview
    this.previewManager.setActiveSession(sessionId);
    
    // Ativar playback
    this.playbackManager.setActiveSession(sessionId);
    
    // Atualizar UI
    this.updateButtonStates();
    this.updateConnectionStatus();
    
    console.log(`🔗 Sessão ativa definida: ${sessionId}`);
  }

  /**
   * Lidar com sessão expirada (sem notificações de erro)
   */
  public handleSessionExpired(): void {
    console.warn('⚠️ Sessão expirada - limpando estado');
    
    // Parar gravação silenciosamente se estiver ativa
    if (this.uiState.isRecording) {
      this.uiState.isRecording = false;
      this.uiState.isPaused = false;
      this.uiState.currentStatus = 'stopped';
      this.stopRecordingTimer();
      this.stopStatusPolling();
    }
    
    // Limpar estado interno
    this.clearActiveSessionInternal();
    
    // Limpar sessão do localStorage
    this.sessionSyncService.clearStoredSession();
    
    // Mostrar notificação informativa (não erro)
    if (window.notificationManager) {
      window.notificationManager.warning(
        'Sessão encerrada',
        'A sessão do navegador foi fechada. Crie uma nova sessão para continuar.'
      );
    }
  }

  /**
   * Limpar sessão ativa (público - com sincronização)
   */
  public clearActiveSession(): void {
    this.clearActiveSessionInternal();
    
    // Limpar sessão do localStorage
    this.sessionSyncService.clearStoredSession();
  }

  /**
   * Limpar sessão ativa (interno - sem sincronização)
   */
  private clearActiveSessionInternal(): void {
    // Parar gravação se estiver ativa
    if (this.uiState.isRecording) {
      this.stopRecording();
    }
    
    // Desativar preview
    this.previewManager.setActiveSession(null);
    
    // Desativar playback
    this.playbackManager.setActiveSession(null);
    
    this.currentSessionId = null;
    this.connectionStatus.playground.configured = false;
    this.connectionStatus.playground.sessionId = undefined;
    
    // Atualizar UI
    this.updateButtonStates();
    this.updateConnectionStatus();
    
    console.log('🔌 Sessão desconectada');
  }

  private toggleSection(sectionType: 'recordingConfig' | 'recordingExecution'): void {
    const contentId = sectionType === 'recordingConfig' ? 'recordingConfigSectionContent' : 'recordingExecutionSectionContent';
    const toggleBtnId = sectionType === 'recordingConfig' ? 'toggleRecordingConfigSection' : 'toggleRecordingExecutionSection';

    const content = document.getElementById(contentId);
    const toggleBtn = document.getElementById(toggleBtnId);

    if (!content || !toggleBtn) return;

    const isCollapsed = content.style.display === 'none';
    
    content.style.display = isCollapsed ? 'block' : 'none';
    
    const icon = toggleBtn.querySelector('.toggle-icon');
    const text = toggleBtn.querySelector('.toggle-text');
    
    if (icon && text) {
      if (isCollapsed) {
        icon.setAttribute('data-lucide', 'chevron-up');
        text.textContent = 'Recolher';
      } else {
        icon.setAttribute('data-lucide', 'chevron-down');
        text.textContent = 'Expandir';
      }
      
      // Reinicializar ícones
      if (typeof window.lucide !== 'undefined') {
        window.lucide.createIcons();
      }
    }
  }

  private clearActions(): void {
    if (this.uiState.isRecording) {
      this.showError('Ação não permitida', 'Não é possível limpar ações durante a gravação.');
      return;
    }

    // Usar método centralizado para limpar eventos
    this.clearCapturedEvents();
    this.updateButtonStates();
    
    console.log('🗑️ Ações limpas');
  }

  private async exportActions(): Promise<void> {
    if (this.uiState.isRecording) {
      this.showError('Ação não permitida', 'Não é possível exportar durante a gravação.');
      return;
    }

    if (this.uiState.eventCount === 0 || !this.uiState.recordingId) {
      this.showError('Nenhuma ação para exportar', 'Grave algumas ações primeiro.');
      return;
    }

    // Mostrar modal de opções de exportação
    this.showExportModal();
  }

  /**
   * Mostrar modal de exportação
   */
  private showExportModal(): void {
    // Criar modal dinamicamente
    const modal = this.createExportModal();
    document.body.appendChild(modal);
    
    // Mostrar modal
    modal.style.display = 'block';
    
    // Configurar event listeners
    this.setupExportModalListeners(modal);
  }

  /**
   * Criar modal de exportação
   */
  private createExportModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'modal export-modal';
    modal.id = 'exportModal';
    
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2><i data-lucide="download"></i> Exportar Gravação</h2>
          <button class="modal-close" id="closeExportModal" title="Fechar">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="export-options">
            
            <div class="field">
              <label>
                <i data-lucide="file-type" class="field-icon"></i>
                Formato de Exportação
              </label>
              <div class="export-format-options">
                <label class="radio-option">
                  <input type="radio" name="exportFormat" value="json" checked>
                  <div class="option-content">
                    <div class="option-title">JSON</div>
                    <div class="option-description">Formato nativo do sistema com todos os dados</div>
                  </div>
                </label>
                <label class="radio-option">
                  <input type="radio" name="exportFormat" value="puppeteer">
                  <div class="option-content">
                    <div class="option-title">Puppeteer Script</div>
                    <div class="option-description">Script JavaScript executável com Puppeteer</div>
                  </div>
                </label>
              </div>
            </div>

            <div class="field">
              <label>
                <i data-lucide="settings" class="field-icon"></i>
                Opções de Exportação
              </label>
              <div class="export-settings">
                <label class="checkbox-option">
                  <input type="checkbox" id="includeScreenshots" checked>
                  <span>Incluir screenshots</span>
                </label>
                <label class="checkbox-option">
                  <input type="checkbox" id="addComments" checked>
                  <span>Adicionar comentários explicativos</span>
                </label>
                <label class="checkbox-option">
                  <input type="checkbox" id="minifyOutput">
                  <span>Minificar saída (JSON apenas)</span>
                </label>
              </div>
            </div>

            <div class="field">
              <label for="exportFilename">
                <i data-lucide="file-text" class="field-icon"></i>
                Nome do Arquivo (opcional)
              </label>
              <input type="text" id="exportFilename" placeholder="Será gerado automaticamente se vazio">
              <small>Deixe vazio para usar nome automático baseado na data/hora</small>
            </div>

          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancelExport">
            <i data-lucide="x"></i>
            Cancelar
          </button>
          <button class="btn btn-primary" id="confirmExport">
            <i data-lucide="download"></i>
            Exportar
          </button>
        </div>
        </div>
      `;
      
    return modal;
  }

  /**
   * Configurar listeners do modal de exportação
   */
  private setupExportModalListeners(modal: HTMLElement): void {
    const closeBtn = modal.querySelector('#closeExportModal');
    const cancelBtn = modal.querySelector('#cancelExport');
    const confirmBtn = modal.querySelector('#confirmExport');
    const overlay = modal.querySelector('.modal-overlay');

    // Fechar modal
    const closeModal = () => {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    // Confirmar exportação
    confirmBtn?.addEventListener('click', async () => {
      await this.performExport(modal);
      closeModal();
    });

    // ESC para fechar
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Reinicializar ícones Lucide
      if (typeof window.lucide !== 'undefined') {
        window.lucide.createIcons();
      }
    }

  /**
   * Executar exportação baseada nas opções selecionadas
   */
  private async performExport(modal: HTMLElement): Promise<void> {
    if (!this.uiState.recordingId) {
      this.showError('Erro na exportação', 'ID da gravação não encontrado');
      return;
    }

    try {
      // Obter opções selecionadas
      const formatRadio = modal.querySelector('input[name="exportFormat"]:checked') as HTMLInputElement;
      const includeScreenshots = (modal.querySelector('#includeScreenshots') as HTMLInputElement).checked;
      const addComments = (modal.querySelector('#addComments') as HTMLInputElement).checked;
      const minifyOutput = (modal.querySelector('#minifyOutput') as HTMLInputElement).checked;
      const customFilename = (modal.querySelector('#exportFilename') as HTMLInputElement).value.trim();

      const options = {
        format: formatRadio.value,
        includeScreenshots,
        addComments,
        minifyOutput,
        filename: customFilename || undefined
      };

      console.log('📤 Iniciando exportação com opções:', options);

      // Chamar API de exportação
      const result = await this.sharedServices.apiService.exportRecording(this.uiState.recordingId, options);

      if (result.success) {
        // Iniciar download do arquivo
        this.downloadFile(result.content, result.filename, this.getMimeType(result.format));
        
        console.log(`✅ Exportação concluída: ${result.filename} (${Math.round(result.size / 1024)}KB)`);
      } else {
        throw new Error(result.error || 'Erro na exportação');
      }

    } catch (error: any) {
      console.error('❌ Erro na exportação:', error);
      this.showError('Erro na exportação', error.message);
    }
  }

  /**
   * Fazer download de arquivo
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Limpar URL após uso
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Obter MIME type baseado no formato
   */
  private getMimeType(format: string): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'puppeteer':
        return 'application/javascript';
      default:
        return 'text/plain';
    }
  }

  private refreshPreview(): void {
    this.previewManager.refreshPreview();
  }

  private playTimeline(): void {
    this.timelineManager.playTimeline();
  }

  private pauseTimeline(): void {
    this.timelineManager.pauseTimeline();
  }

  private stopTimeline(): void {
    this.timelineManager.stopTimeline();
  }

  private takePreviewScreenshot(): void {
    this.previewManager.captureScreenshot();
  }

  private toggleFullscreenPreview(): void {
    this.previewManager.toggleFullscreen();
  }

  /**
   * Obter estado atual da UI
   */
  public getUIState(): RecordingUIState {
    return { ...this.uiState };
  }

  /**
   * Obter configuração atual da UI
   */
  public getUIConfig(): RecordingUIConfig {
    return { ...this.uiConfig };
  }

  /**
   * Cleanup ao destruir o manager
   */
  public destroy(): void {
    // Parar gravação se ativa
    if (this.uiState.isRecording) {
      this.stopRecording();
    }

    // Limpar timers
    this.stopRecordingTimer();
    this.stopStatusPolling();

    // Destruir PreviewManager
    this.previewManager.destroy();
    
    // Destruir TimelineManager
    this.timelineManager.destroy();
    
    // Destruir PlaybackManager
    this.playbackManager.destroy();
    
    // Destruir SessionSyncService
    this.sessionSyncService.destroy();

    console.log('🧹 RecordingManager destruído');
  }

  // ==========================================
  // MÉTODOS WEBSOCKET
  // ==========================================

  /**
   * Definir status de conexão WebSocket
   */
  public setWebSocketConnected(connected: boolean): void {
    this.connectionStatus.websocket.connected = connected;
    this.updateConnectionStatus();
    
    if (connected) {
      console.log('🔗 WebSocket conectado');
    } else {
      console.log('🔌 WebSocket desconectado');
    }
  }

  /**
   * Processar mensagem WebSocket de gravação
   */
  public handleWebSocketMessage(message: RecordingWebSocketMessage): void {
    console.log('📡 Processando mensagem WebSocket:', message);

    // Verificar se a mensagem é para nossa gravação ativa
    if (this.uiState.recordingId && message.recordingId !== this.uiState.recordingId) {
      return; // Ignorar mensagens de outras gravações
    }

    switch (message.type) {
      case 'recording_event':
        this.handleRecordingEvent(message);
        break;
      case 'recording_status':
        this.handleRecordingStatus(message);
        break;
      case 'recording_error':
        this.handleRecordingError(message);
        break;
      default:
        console.log('📨 Tipo de mensagem desconhecido:', message.type);
    }
  }

  /**
   * Processar evento de gravação recebido via WebSocket
   */
  private handleRecordingEvent(message: RecordingWebSocketMessage): void {
    const eventData = message.data as RecordingEvent;
    
    if (!eventData) {
      console.warn('⚠️ Evento sem dados recebido');
      return;
    }

    // Adicionar evento à lista
    this.capturedEvents.push(eventData);
    this.uiState.eventCount = this.capturedEvents.length;
    this.uiState.lastEventTime = new Date(eventData.timestamp);

    // Atualizar timeline
    this.updateTimeline();
    
    // Atualizar timeline manager
    this.timelineManager.setEvents(this.capturedEvents, this.uiState.startTime?.getTime() || Date.now());

    // Atualizar contadores na UI
    this.updateActionsCount();

    // Adicionar evento à lista visual
    this.addEventToList(eventData);

    // Log do evento
    console.log(`📝 Evento capturado via WebSocket: ${eventData.type} (Total: ${this.capturedEvents.length})`);
  }

  /**
   * Processar status de gravação recebido via WebSocket
   */
  private handleRecordingStatus(message: RecordingWebSocketMessage): void {
    const statusData = message.data as any;
    
    if (statusData.status) {
      this.uiState.currentStatus = statusData.status;
      this.updateRecordingUI();
    }

    if (statusData.eventCount !== undefined) {
      this.uiState.eventCount = statusData.eventCount;
      this.updateActionsCount();
    }

    console.log(`📊 Status atualizado via WebSocket: ${statusData.status || 'unknown'}`);
  }

  /**
   * Processar erro de gravação recebido via WebSocket
   */
  private handleRecordingError(message: RecordingWebSocketMessage): void {
    const errorData = message.data as { error: string };
    
    this.uiState.error = errorData.error;
    this.uiState.currentStatus = 'error';
    
    this.updateRecordingUI();
    this.showError('Erro na gravação', errorData.error);

    console.error('❌ Erro de gravação via WebSocket:', errorData.error);
  }

  /**
   * Adicionar evento à lista visual
   */
  private addEventToList(event: RecordingEvent): void {
    const actionsList = document.getElementById('actionsList');
    if (!actionsList) return;

    // Remover placeholder se existir
    const emptyPlaceholder = actionsList.querySelector('.actions-empty');
    if (emptyPlaceholder) {
      emptyPlaceholder.remove();
    }

    // Criar elemento do evento
    const eventElement = this.createEventElement(event);
    
    // Adicionar ao início da lista (eventos mais recentes primeiro)
    actionsList.insertBefore(eventElement, actionsList.firstChild);

    // Limitar número de eventos visíveis (performance)
    const maxVisibleEvents = 50;
    const eventElements = actionsList.querySelectorAll('.action-item');
    if (eventElements.length > maxVisibleEvents) {
      for (let i = maxVisibleEvents; i < eventElements.length; i++) {
        eventElements[i].remove();
      }
    }
  }

  /**
   * Criar elemento HTML para um evento
   */
  private createEventElement(event: RecordingEvent): HTMLElement {
    const eventDiv = document.createElement('div');
    eventDiv.className = `action-item ${getEventColor(event.type)}`;
    
    const timeStr = formatTimestamp(event.timestamp);
    const icon = getEventIcon(event.type);
    
    let details = '';
    switch (event.type) {
      case 'click':
        details = event.coordinates ? 
          `(${event.coordinates.x}, ${event.coordinates.y})` : 
          '';
        break;
      case 'type':
        details = event.value ? 
          `"${truncateText(event.value, 30)}"` : 
          '';
        break;
      case 'navigation':
        details = event.url ? truncateUrl(event.url, 50) : '';
        break;
      case 'scroll':
        details = event.coordinates ? 
          `Y: ${event.coordinates.y}` : 
          '';
        break;
      default:
        details = event.selector ? truncateSelector(event.selector, 35) : '';
    }

    // Criar tooltip com informações completas
    const fullDetails = this.createEventTooltip(event);
    
    eventDiv.innerHTML = `
      <div class="action-header">
        <div class="action-info">
          <i data-lucide="${icon}" class="action-icon"></i>
          <span class="action-type">${event.type}</span>
          <span class="action-time">${timeStr}</span>
        </div>
        ${event.screenshot ? '<i data-lucide="camera" class="screenshot-indicator" title="Screenshot capturado"></i>' : ''}
      </div>
      ${details ? `<div class="action-details" title="${fullDetails}">${details}</div>` : ''}
      ${event.selector ? `<div class="action-selector" title="${event.selector}">${truncateSelector(event.selector, 40)}</div>` : ''}
    `;

    // Reinicializar ícones Lucide
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }

    return eventDiv;
  }

  /**
   * Criar tooltip com informações completas do evento
   */
  private createEventTooltip(event: RecordingEvent): string {
    const parts = [];
    
    parts.push(`Tipo: ${event.type}`);
    parts.push(`Timestamp: ${formatTimestamp(event.timestamp)}`);
    
    if (event.url) {
      parts.push(`URL: ${event.url}`);
    }
    
    if (event.selector) {
      parts.push(`Seletor: ${event.selector}`);
    }
    
    if (event.value) {
      parts.push(`Valor: ${event.value}`);
    }
    
    if (event.coordinates) {
      parts.push(`Coordenadas: (${event.coordinates.x}, ${event.coordinates.y})`);
    }
    
    if (event.duration) {
      parts.push(`Duração: ${event.duration}ms`);
    }
    
    return parts.join('\n');
  }

  /**
   * Atualizar timeline (método simplificado)
   */
  private updateTimeline(): void {
    // O TimelineManager agora gerencia a timeline
    // Este método é mantido para compatibilidade
  }

  /**
   * Obter eventos capturados
   */
  public getCapturedEvents(): RecordingEvent[] {
    return [...this.capturedEvents];
  }

  /**
   * Limpar eventos capturados
   */
  public clearCapturedEvents(): void {
    this.capturedEvents = [];
    this.timelineItems = [];
    this.uiState.eventCount = 0;
    
    // Limpar timeline manager
    this.timelineManager.setEvents([], Date.now());
    
    this.updateActionsCount();
    this.clearActionsUI();
    this.clearTimelineUI();
  }

  /**
   * Limpar UI de ações
   */
  private clearActionsUI(): void {
    const actionsList = document.getElementById('actionsList');
    if (actionsList) {
      actionsList.innerHTML = `
        <div class="actions-empty">
          <i data-lucide="mouse-pointer" class="empty-icon"></i>
          <p>Nenhuma ação gravada ainda</p>
          <small>As ações aparecerão aqui conforme você interage com a página</small>
        </div>
      `;
    }
  }

  /**
   * Limpar UI da timeline
   */
  private clearTimelineUI(): void {
    const timelineTrack = document.getElementById('timelineTrack');
    if (timelineTrack) {
      timelineTrack.innerHTML = `
        <div class="timeline-empty">
          <i data-lucide="activity" class="empty-icon"></i>
          <p>Timeline vazia</p>
          <small>A timeline será preenchida conforme as ações são gravadas</small>
        </div>
      `;
    }
      
      // Reinicializar ícones
      if (typeof window.lucide !== 'undefined') {
        window.lucide.createIcons();
      }
  }
}
