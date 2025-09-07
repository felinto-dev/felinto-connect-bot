import type { SharedServices } from '../shared';
import type { 
  RecordingData,
  PlaybackConfig,
  PlaybackState
} from '../shared/types/recording';
import { ValidationService } from '../shared/utils/validation';
import { formatDuration } from '../shared/utils/recording';

export class PlaybackManager {
  private sharedServices: SharedServices;
  private currentRecording: RecordingData | null = null;
  private currentSessionId: string | null = null;
  private playbackState: PlaybackState | null = null;
  private statusPollingInterval: number | null = null;

  constructor(sharedServices: SharedServices) {
    this.sharedServices = sharedServices;
  }

  /**
   * Inicializar playback manager
   */
  public init(): void {
    this.setupEventListeners();
    this.initializeUI();
  }

  /**
   * Configurar event listeners
   */
  private setupEventListeners(): void {
    // Botão de importar gravação
    document.getElementById('importRecordingBtn')?.addEventListener('click', () => {
      this.showImportModal();
    });

    // Input de arquivo para importação
    const fileInput = document.getElementById('importFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        this.handleFileImport(e);
      });
    }
  }

  /**
   * Inicializar UI
   */
  private initializeUI(): void {
    this.updatePlaybackUI();
  }

  /**
   * Mostrar modal de importação
   */
  public showImportModal(): void {
    const modal = this.createImportModal();
    document.body.appendChild(modal);
    modal.style.display = 'block';
    this.setupImportModalListeners(modal);
  }

  /**
   * Criar modal de importação
   */
  private createImportModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'modal import-modal';
    modal.id = 'importModal';
    
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2><i data-lucide="upload"></i> Importar Gravação</h2>
          <button class="modal-close" id="closeImportModal" title="Fechar">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="import-options">
            
            <div class="field">
              <label>
                <i data-lucide="file" class="field-icon"></i>
                Selecionar Arquivo
              </label>
              <div class="file-input-container">
                <input type="file" id="importFileInput" accept=".json" class="file-input">
                <div class="file-input-display">
                  <i data-lucide="upload-cloud" class="upload-icon"></i>
                  <span class="upload-text">Clique para selecionar arquivo JSON</span>
                  <small>Apenas arquivos .json são suportados</small>
                </div>
              </div>
            </div>

            <div class="import-preview" id="importPreview" style="display: none;">
              <h4><i data-lucide="info"></i> Informações da Gravação</h4>
              <div class="preview-content">
                <div class="preview-item">
                  <label>ID da Gravação:</label>
                  <span id="previewRecordingId">-</span>
                </div>
                <div class="preview-item">
                  <label>Total de Eventos:</label>
                  <span id="previewEventCount">-</span>
                </div>
                <div class="preview-item">
                  <label>Duração:</label>
                  <span id="previewDuration">-</span>
                </div>
                <div class="preview-item">
                  <label>URL Inicial:</label>
                  <span id="previewInitialUrl">-</span>
                </div>
              </div>
            </div>

          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancelImport">
            <i data-lucide="x"></i>
            Cancelar
          </button>
          <button class="btn btn-primary" id="confirmImport" disabled>
            <i data-lucide="play"></i>
            Reproduzir
          </button>
        </div>
      </div>
    `;

    return modal;
  }

  /**
   * Configurar listeners do modal de importação
   */
  private setupImportModalListeners(modal: HTMLElement): void {
    const closeBtn = modal.querySelector('#closeImportModal');
    const cancelBtn = modal.querySelector('#cancelImport');
    const confirmBtn = modal.querySelector('#confirmImport');
    const overlay = modal.querySelector('.modal-overlay');
    const fileInput = modal.querySelector('#importFileInput') as HTMLInputElement;

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

    // Confirmar importação e reprodução
    confirmBtn?.addEventListener('click', async () => {
      if (this.currentRecording) {
        await this.startPlayback(this.currentRecording);
        closeModal();
      }
    });

    // Processar arquivo selecionado
    fileInput?.addEventListener('change', (e) => {
      this.handleFileImport(e, modal);
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
   * Processar importação de arquivo
   */
  private handleFileImport(event: Event, modal?: HTMLElement): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      this.showError('Formato inválido', 'Apenas arquivos JSON são suportados.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const recordingData = JSON.parse(content);
        
        // Validar arquivo usando ValidationService
        const validation = ValidationService.validateRecordingFile(recordingData);
        
        if (!validation.isValid) {
          ValidationService.showValidationResult(validation, 'Importação de Arquivo');
          throw new Error(validation.errors[0]);
        }

        // Mostrar warnings se houver
        if (validation.warnings.length > 0) {
          ValidationService.showValidationResult(validation, 'Importação de Arquivo');
        }

        this.currentRecording = recordingData;
        
        if (modal) {
          this.updateImportPreview(modal, recordingData);
        }
        
        console.log(`📂 Arquivo importado: ${recordingData.events.length} eventos`);
        
        if (window.notificationManager) {
          window.notificationManager.success(
            'Arquivo importado', 
            `${recordingData.events.length} eventos carregados`
          );
        }

      } catch (error: any) {
        console.error('❌ Erro ao processar arquivo:', error);
        this.showError('Erro ao importar', error.message);
      }
    };

    reader.readAsText(file);
  }

  /**
   * Atualizar preview de importação
   */
  private updateImportPreview(modal: HTMLElement, recording: any): void {
    const preview = modal.querySelector('#importPreview') as HTMLElement;
    const confirmBtn = modal.querySelector('#confirmImport') as HTMLButtonElement;
    
    if (preview) {
      preview.style.display = 'block';
      
      // Atualizar informações
      const recordingIdElement = modal.querySelector('#previewRecordingId');
      const eventCountElement = modal.querySelector('#previewEventCount');
      const durationElement = modal.querySelector('#previewDuration');
      const initialUrlElement = modal.querySelector('#previewInitialUrl');
      
      if (recordingIdElement) recordingIdElement.textContent = recording.metadata?.recordingId || 'N/A';
      if (eventCountElement) eventCountElement.textContent = recording.events.length.toString();
      if (durationElement) {
        const duration = recording.timeline?.duration || 0;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        durationElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      if (initialUrlElement) initialUrlElement.textContent = recording.metadata?.initialUrl || 'N/A';
    }
    
    // Habilitar botão de confirmação
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
  }

  /**
   * Iniciar reprodução
   */
  private async startPlayback(recording: RecordingData): Promise<void> {
    if (!this.currentSessionId) {
      this.showError('Sessão necessária', 'Crie uma sessão no Playground primeiro.');
      return;
    }

    try {
      console.log('▶️ Iniciando reprodução...');
      
      const config = {
        speed: 1,
        pauseOnError: true,
        skipScreenshots: false
      };

      const response = await this.sharedServices.apiService.startPlayback(
        recording.id, 
        this.currentSessionId, 
        config
      );

      if (response.success) {
        this.playbackState = response.status;
        this.startPlaybackStatusPolling(recording.id);
        this.updatePlaybackUI();
        
        console.log(`✅ Reprodução iniciada: ${recording.id}`);
      } else {
        throw new Error(response.error || 'Erro ao iniciar reprodução');
      }

    } catch (error: any) {
      console.error('❌ Erro ao iniciar reprodução:', error);
      this.showError('Erro na reprodução', error.message);
    }
  }

  /**
   * Iniciar polling de status da reprodução
   */
  private startPlaybackStatusPolling(recordingId: string): void {
    this.stopPlaybackStatusPolling();
    
    this.statusPollingInterval = window.setInterval(async () => {
      try {
        const response = await this.sharedServices.apiService.getPlaybackStatus(recordingId);
        
        if (response.success) {
          this.playbackState = response.status;
          this.updatePlaybackUI();
          
          // Parar polling se reprodução terminou
          if (!response.isActive) {
            this.stopPlaybackStatusPolling();
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status da reprodução:', error);
      }
    }, 1000); // Verificar a cada segundo
  }

  /**
   * Parar polling de status
   */
  private stopPlaybackStatusPolling(): void {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  }

  /**
   * Atualizar UI de reprodução
   */
  private updatePlaybackUI(): void {
    // Atualizar informações na timeline se estiver reproduzindo
    if (this.playbackState) {
      const currentEventElement = document.getElementById('currentEventIndex');
      const totalEventsElement = document.getElementById('totalEvents');
      const elapsedTimeElement = document.getElementById('elapsedTime');
      const remainingTimeElement = document.getElementById('remainingTime');

      if (currentEventElement) {
        currentEventElement.textContent = (this.playbackState.currentEventIndex + 1).toString();
      }
      if (totalEventsElement) {
        totalEventsElement.textContent = this.playbackState.totalEvents.toString();
      }
      if (elapsedTimeElement) {
        const minutes = Math.floor(this.playbackState.elapsedTime / 60000);
        const seconds = Math.floor((this.playbackState.elapsedTime % 60000) / 1000);
        elapsedTimeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      if (remainingTimeElement) {
        const minutes = Math.floor(this.playbackState.remainingTime / 60000);
        const seconds = Math.floor((this.playbackState.remainingTime % 60000) / 1000);
        remainingTimeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }

      console.log(`🎬 Reprodução: evento ${this.playbackState.currentEventIndex + 1}/${this.playbackState.totalEvents}`);
    }
  }

  /**
   * Definir sessão ativa
   */
  public setActiveSession(sessionId: string | null): void {
    this.currentSessionId = sessionId;
    
    if (!sessionId) {
      // Parar reprodução se estiver ativa
      this.stopCurrentPlayback();
    }
  }

  /**
   * Parar reprodução atual
   */
  private async stopCurrentPlayback(): Promise<void> {
    if (this.currentRecording && this.playbackState?.isPlaying) {
      try {
        await this.sharedServices.apiService.controlPlayback(this.currentRecording.id, 'stop');
        this.stopPlaybackStatusPolling();
        this.playbackState = null;
        this.updatePlaybackUI();
      } catch (error) {
        console.error('Erro ao parar reprodução:', error);
      }
    }
  }

  /**
   * Mostrar erro
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
   * Obter estado atual
   */
  public getPlaybackState(): PlaybackState | null {
    return this.playbackState;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopCurrentPlayback();
    this.stopPlaybackStatusPolling();
    this.currentRecording = null;
    this.currentSessionId = null;
    
    console.log('🧹 PlaybackManager destruído');
  }
}
