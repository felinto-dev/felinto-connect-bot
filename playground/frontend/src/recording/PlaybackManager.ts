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
    // Não há mais event listeners para importação (funcionalidade removida)
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
