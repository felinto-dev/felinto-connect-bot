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
  private focusCheckInterval: number | null = null;

  constructor(sharedServices: SharedServices) {
    this.sharedServices = sharedServices;
    
    // Configuração padrão - Smart refresh sempre ativo
    this.config = {
      autoRefresh: true,
      refreshInterval: 3000, // 3 segundos
      showCursor: true,
      highlightElements: true,
      fullscreen: false,
      smartRefresh: true // Sempre ativo, não configurável pelo usuário
    };

    // Estado inicial
    this.state = {
      isActive: false,
      error: undefined,
      isPageFocused: document.hasFocus(),
      isCursorOverPreview: false
    };
  }

  /**
   * Inicializar preview manager
   */
  public init(): void {
    this.setupEventListeners();
    this.initializeUI();
    this.setupFocusAndCursorTracking();
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


  }

  /**
   * Inicializar UI
   */
  private initializeUI(): void {
    this.updatePreviewPlaceholder();
    this.updateButtonStates();
  }

  /**
   * Configurar rastreamento de foco e cursor
   */
  private setupFocusAndCursorTracking(): void {
    // Rastrear foco da página
    window.addEventListener('focus', () => {
      this.state.isPageFocused = true;
      console.log('🔍 Página em foco - smart refresh pode ativar');
      this.updateSmartRefresh();
    });

    window.addEventListener('blur', () => {
      this.state.isPageFocused = false;
      console.log('😴 Página perdeu foco - smart refresh pausado');
      this.updateSmartRefresh();
    });

    // Rastrear cursor sobre área do preview
    const previewContainer = document.querySelector('.preview-container');
    if (previewContainer) {
      previewContainer.addEventListener('mouseenter', () => {
        this.state.isCursorOverPreview = true;
        console.log('🖱️ Cursor sobre preview - smart refresh pode ativar');
        this.updateSmartRefresh();
      });

      previewContainer.addEventListener('mouseleave', () => {
        this.state.isCursorOverPreview = false;
        console.log('🖱️ Cursor saiu do preview - smart refresh pausado');
        this.updateSmartRefresh();
      });
    }

    // Verificar foco periodicamente (fallback para casos edge)
    this.focusCheckInterval = window.setInterval(() => {
      const currentFocus = document.hasFocus();
      if (currentFocus !== this.state.isPageFocused) {
        this.state.isPageFocused = currentFocus;
        this.updateSmartRefresh();
      }
    }, 5000); // Verificar a cada 5 segundos
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
      this.captureScreenshot();
      
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
          <button class="btn btn-small btn-secondary" onclick="window.recordingApp?.recordingManager?.previewManager?.captureScreenshot()">
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
        this.executeSmartRefresh();
      }, this.config.refreshInterval);
      
      console.log(`🔄 Auto-refresh iniciado: ${this.config.refreshInterval}ms (smart refresh sempre ativo)`);
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

    if (this.focusCheckInterval) {
      clearInterval(this.focusCheckInterval);
      this.focusCheckInterval = null;
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
   * Executar smart refresh - só faz refresh se condições forem atendidas
   */
  private executeSmartRefresh(): void {
    // Verificar condições do smart refresh (sempre ativo)
    const shouldRefresh = this.state.isPageFocused && this.state.isCursorOverPreview;
    
    if (shouldRefresh) {
      console.log('✅ Smart refresh: condições atendidas - fazendo refresh');
      this.captureScreenshot();
    } else {
      const reasons = [];
      if (!this.state.isPageFocused) reasons.push('página não está em foco');
      if (!this.state.isCursorOverPreview) reasons.push('cursor não está sobre preview');
      
      console.log(`⏸️ Smart refresh: pulando refresh (${reasons.join(', ')})`);
    }
  }

  /**
   * Atualizar smart refresh quando estado de foco/cursor muda
   */
  private updateSmartRefresh(): void {
    // Se ambas condições estão atendidas e não fizemos refresh recentemente, fazer um refresh imediato
    const shouldRefresh = this.state.isPageFocused && this.state.isCursorOverPreview;
    const timeSinceLastUpdate = this.state.lastUpdate ? Date.now() - this.state.lastUpdate.getTime() : Infinity;
    const minInterval = Math.max(1000, this.config.refreshInterval / 2); // Mínimo 1s ou metade do intervalo

    if (shouldRefresh && timeSinceLastUpdate > minInterval) {
      console.log('🚀 Smart refresh: fazendo refresh imediato (condições recém atendidas)');
      this.captureScreenshot();
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
