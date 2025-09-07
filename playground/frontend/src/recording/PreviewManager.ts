import type { SharedServices } from '../shared';
import type { 
  PreviewConfig, 
  PreviewState,
  ConnectionStatus 
} from '../shared/types/recording';
import { truncateUrl } from '../shared/utils/recording';

export class PreviewManager {
  private sharedServices: SharedServices;
  private config: PreviewConfig;
  private state: PreviewState;
  private refreshInterval: number | null = null;
  private currentSessionId: string | null = null;
  private isFullscreen: boolean = false;

  constructor(sharedServices: SharedServices) {
    this.sharedServices = sharedServices;
    
    // Configuração padrão
    this.config = {
      autoRefresh: true,
      refreshInterval: 3000, // 3 segundos
      showCursor: true,
      highlightElements: true,
      fullscreen: false
    };

    // Estado inicial
    this.state = {
      isActive: false,
      error: undefined
    };
  }

  /**
   * Inicializar preview manager
   */
  public init(): void {
    this.setupEventListeners();
    this.initializeUI();
  }

  /**
   * Configurar event listeners
   */
  private setupEventListeners(): void {
    // Botão de capturar screenshot
    document.getElementById('takePreviewScreenshot')?.addEventListener('click', () => {
      this.captureScreenshot();
    });

    // Botão de fullscreen
    document.getElementById('fullscreenPreview')?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // Botão de refresh
    document.getElementById('refreshPreviewBtn')?.addEventListener('click', () => {
      this.refreshPreview();
    });

    // Configurar auto-refresh checkbox (se existir)
    const autoRefreshCheckbox = document.getElementById('autoRefreshPreview') as HTMLInputElement;
    if (autoRefreshCheckbox) {
      autoRefreshCheckbox.checked = this.config.autoRefresh;
      autoRefreshCheckbox.addEventListener('change', (e) => {
        this.config.autoRefresh = (e.target as HTMLInputElement).checked;
        this.updateAutoRefresh();
      });
    }

    // Configurar intervalo de refresh (se existir)
    const refreshIntervalInput = document.getElementById('refreshInterval') as HTMLInputElement;
    if (refreshIntervalInput) {
      refreshIntervalInput.value = this.config.refreshInterval.toString();
      refreshIntervalInput.addEventListener('change', (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        if (value >= 1000 && value <= 30000) { // Entre 1s e 30s
          this.config.refreshInterval = value;
          this.updateAutoRefresh();
        }
      });
    }
  }

  /**
   * Inicializar UI
   */
  private initializeUI(): void {
    this.updatePreviewPlaceholder();
    this.updateButtonStates();
  }

  /**
   * Definir sessão ativa
   */
  public setActiveSession(sessionId: string | null): void {
    const wasActive = this.currentSessionId !== null;
    this.currentSessionId = sessionId;

    if (sessionId) {
      this.state.isActive = true;
      this.state.error = undefined;
      
      // Iniciar auto-refresh se configurado
      if (this.config.autoRefresh) {
        this.startAutoRefresh();
      }
      
      // Capturar preview inicial
      this.refreshPreview();
      
      console.log(`📺 Preview ativado para sessão: ${sessionId}`);
    } else {
      this.state.isActive = false;
      this.stopAutoRefresh();
      this.clearPreview();
      
      if (wasActive) {
        console.log('📺 Preview desativado');
      }
    }

    this.updateButtonStates();
    this.updatePreviewPlaceholder();
  }

  /**
   * Atualizar preview
   */
  public async refreshPreview(): Promise<void> {
    if (!this.currentSessionId) {
      this.showError('Nenhuma sessão ativa para capturar preview. Use "Iniciar Gravação" para criar uma sessão automaticamente.');
      return;
    }

    try {
      console.log('🔄 Atualizando preview...');
      
      const response = await this.sharedServices.apiService.getPreview(this.currentSessionId);
      
      if (response.success && response.preview) {
        this.displayPreview(response.preview, response.metadata);
        this.state.error = undefined;
        this.state.lastUpdate = new Date();
        
        console.log('✅ Preview atualizado');
      } else {
        throw new Error(response.error || 'Erro ao obter preview');
      }

    } catch (error: any) {
      console.error('❌ Erro ao atualizar preview:', error);
      
      // Verificar se é erro de sessão fechada
      if (error.message?.includes('sessionExpired') || 
          error.message?.includes('Sessão foi fechada') ||
          error.message?.includes('Sessão não encontrada')) {
        
        console.warn('⚠️ Sessão expirada detectada, parando auto-refresh');
        this.handleSessionExpired();
        return;
      }
      
      this.showError(`Erro ao atualizar preview: ${error.message}`);
      this.state.error = error.message;
    }

    this.updatePreviewInfo();
  }

  /**
   * Capturar screenshot de alta qualidade
   */
  public async captureScreenshot(fullPage: boolean = false): Promise<void> {
    if (!this.currentSessionId) {
      this.showError('Nenhuma sessão ativa para capturar screenshot');
      return;
    }

    try {
      console.log('📸 Capturando screenshot...');
      
      const response = await this.sharedServices.apiService.captureScreenshot(
        this.currentSessionId, 
        { quality: 90, fullPage }
      );
      
      if (response.success && response.screenshot) {
        this.displayPreview(response.screenshot, response.metadata);
        this.state.error = undefined;
        this.state.lastUpdate = new Date();
        
        console.log(`✅ Screenshot capturado: ${response.metadata.size}KB`);
        
        // Mostrar notificação de sucesso
        this.showSuccessNotification(`Screenshot capturado (${response.metadata.size}KB)`);
      } else {
        throw new Error(response.error || 'Erro ao capturar screenshot');
      }

    } catch (error: any) {
      console.error('❌ Erro ao capturar screenshot:', error);
      
      // Verificar se é erro de sessão fechada
      if (error.message?.includes('sessionExpired') || 
          error.message?.includes('Sessão foi fechada') ||
          error.message?.includes('Sessão não encontrada')) {
        
        console.warn('⚠️ Sessão expirada detectada durante screenshot');
        this.handleSessionExpired();
        return;
      }
      
      this.showError(`Erro ao capturar screenshot: ${error.message}`);
    }
  }

  /**
   * Exibir preview na UI
   */
  private displayPreview(imageData: string, metadata?: any): void {
    const previewViewport = document.getElementById('previewViewport');
    if (!previewViewport) return;

    // Limpar conteúdo anterior
    previewViewport.innerHTML = '';

    // Criar elemento de imagem
    const img = document.createElement('img');
    img.src = imageData;
    img.alt = 'Preview da página';
    img.className = 'preview-image';
    
    // Adicionar event listeners para a imagem
    img.onload = () => {
      console.log('🖼️ Imagem de preview carregada');
    };
    
    img.onerror = () => {
      console.error('❌ Erro ao carregar imagem de preview');
      this.showError('Erro ao carregar imagem de preview');
    };

    // Adicionar imagem ao viewport
    previewViewport.appendChild(img);

    // Atualizar URL se disponível
    if (metadata?.url) {
      this.updatePreviewUrl(metadata.url);
      this.state.currentUrl = metadata.url;
    }

    // Armazenar último screenshot
    this.state.lastScreenshot = imageData;
  }

  /**
   * Atualizar URL do preview
   */
  private updatePreviewUrl(url: string): void {
    const previewUrlElement = document.getElementById('previewUrl');
    if (previewUrlElement) {
      // Truncar URL para evitar quebra de layout, mas manter URL completa no tooltip
      const truncatedUrl = truncateUrl(url, 60);
      previewUrlElement.textContent = truncatedUrl;
      previewUrlElement.title = url; // URL completa no tooltip
    }
  }

  /**
   * Atualizar informações do preview
   */
  private updatePreviewInfo(): void {
    // Aqui poderia mostrar informações adicionais como timestamp da última atualização
    const lastUpdateElement = document.getElementById('previewLastUpdate');
    if (lastUpdateElement && this.state.lastUpdate) {
      lastUpdateElement.textContent = this.state.lastUpdate.toLocaleTimeString();
    }
  }

  /**
   * Limpar preview
   */
  private clearPreview(): void {
    const previewViewport = document.getElementById('previewViewport');
    if (previewViewport) {
      this.updatePreviewPlaceholder();
    }

    this.updatePreviewUrl('Aguardando conexão...');
    this.state.currentUrl = undefined;
    this.state.lastScreenshot = undefined;
    this.state.lastUpdate = undefined;
  }

  /**
   * Atualizar placeholder do preview
   */
  private updatePreviewPlaceholder(): void {
    const previewViewport = document.getElementById('previewViewport');
    if (!previewViewport) return;

    if (!this.state.isActive) {
      previewViewport.innerHTML = `
        <div class="preview-placeholder">
          <i data-lucide="monitor" class="placeholder-icon"></i>
          <p>Preview aparecerá aqui quando a gravação iniciar</p>
          <small>Configure o playground e inicie a gravação para ver o preview</small>
        </div>
      `;
    } else if (this.state.error) {
      previewViewport.innerHTML = `
        <div class="preview-placeholder error">
          <i data-lucide="alert-circle" class="placeholder-icon"></i>
          <p>Erro ao carregar preview</p>
          <small>${this.state.error}</small>
          <button class="btn btn-small btn-secondary" onclick="window.recordingApp?.recordingManager?.previewManager?.refreshPreview()">
            <i data-lucide="refresh-cw"></i>
            Tentar novamente
          </button>
        </div>
      `;
    }

    // Reinicializar ícones Lucide
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  }

  /**
   * Iniciar auto-refresh
   */
  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    
    if (this.config.autoRefresh && this.currentSessionId) {
      this.refreshInterval = window.setInterval(() => {
        this.refreshPreview();
      }, this.config.refreshInterval);
      
      console.log(`🔄 Auto-refresh iniciado: ${this.config.refreshInterval}ms`);
    }
  }

  /**
   * Parar auto-refresh
   */
  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('⏸️ Auto-refresh parado');
    }
  }

  /**
   * Atualizar auto-refresh baseado na configuração
   */
  private updateAutoRefresh(): void {
    if (this.state.isActive) {
      this.startAutoRefresh();
    }
  }

  /**
   * Toggle fullscreen
   */
  private toggleFullscreen(): void {
    const previewContainer = document.querySelector('.preview-container');
    if (!previewContainer) return;

    this.isFullscreen = !this.isFullscreen;

    if (this.isFullscreen) {
      previewContainer.classList.add('fullscreen');
      document.body.classList.add('preview-fullscreen');
    } else {
      previewContainer.classList.remove('fullscreen');
      document.body.classList.remove('preview-fullscreen');
    }

    this.updateButtonStates();
    console.log(`🔍 Fullscreen ${this.isFullscreen ? 'ativado' : 'desativado'}`);
  }

  /**
   * Atualizar estados dos botões
   */
  private updateButtonStates(): void {
    const screenshotBtn = document.getElementById('takePreviewScreenshot') as HTMLButtonElement;
    const fullscreenBtn = document.getElementById('fullscreenPreview') as HTMLButtonElement;
    const refreshBtn = document.getElementById('refreshPreviewBtn') as HTMLButtonElement;

    const isEnabled = this.state.isActive && this.currentSessionId !== null;

    if (screenshotBtn) {
      screenshotBtn.disabled = !isEnabled;
    }

    if (fullscreenBtn) {
      fullscreenBtn.disabled = !isEnabled;
      const icon = fullscreenBtn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', this.isFullscreen ? 'minimize' : 'maximize');
      }
    }

    if (refreshBtn) {
      refreshBtn.disabled = !isEnabled;
    }

    // Reinicializar ícones Lucide
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  }

  /**
   * Mostrar erro
   */
  private showError(message: string): void {
    console.error('❌ Preview Error:', message);
    
    if (window.notificationManager) {
      window.notificationManager.error('Erro no Preview', message);
    }
  }

  /**
   * Mostrar notificação de sucesso
   */
  private showSuccessNotification(message: string): void {
    console.log('✅ Preview Success:', message);
    
    if (window.notificationManager) {
      window.notificationManager.success('Preview', message);
    }
  }

  /**
   * Obter estado atual
   */
  public getState(): PreviewState {
    return { ...this.state };
  }

  /**
   * Obter configuração atual
   */
  public getConfig(): PreviewConfig {
    return { ...this.config };
  }

  /**
   * Lidar com sessão expirada
   */
  private handleSessionExpired(): void {
    // Parar auto-refresh para evitar mais erros
    this.stopAutoRefresh();
    
    // Atualizar estado
    this.state.isActive = false;
    this.state.error = 'Sessão foi fechada';
    this.currentSessionId = null;
    
    // Limpar preview
    this.clearPreview();
    
    // Atualizar botões
    this.updateButtonStates();
    
    // Notificar sobre sessão expirada (sem mostrar erro, apenas info)
    console.warn('⚠️ Preview desativado - sessão foi fechada');
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopAutoRefresh();
    this.currentSessionId = null;
    this.state.isActive = false;
    
    console.log('🧹 PreviewManager destruído');
  }
}
