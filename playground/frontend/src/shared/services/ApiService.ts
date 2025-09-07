import { AppConfig } from '../types/config';
import { 
  CreateSessionResponse, 
  ExecuteCodeResponse,
  ApiErrorResponse,
  StartRecordingResponse,
  StopRecordingResponse,
  PauseRecordingResponse,
  RecordingStatusResponse,
  StartRecordingPayload
} from '../types/api';
import type { RecordingConfig } from '../types/recording';

// Definindo uma classe de erro customizada para a API
class ApiError extends Error {
  details?: ApiErrorResponse;

  constructor(message: string, details?: ApiErrorResponse) {
    super(message);
    this.name = 'ApiError';
    this.details = details;
  }
}

export default class ApiService {

  async _fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(endpoint, options);
      const result = await response.json();

      if (!response.ok) {
        const errorDetails: ApiErrorResponse = result;
        throw new ApiError(errorDetails.error || 'Erro na API', errorDetails);
      }

      return result as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      // Para outros erros (ex: rede), lançar um erro genérico
      throw new Error(error instanceof Error ? error.message : 'Erro de conexão com a API');
    }
  }

  checkChromeStatus(): Promise<{ message: string }> {
    return this._fetch('/api/chrome/check');
  }

  async validateWebSocketEndpoint(endpoint: string): Promise<any> {
    try {
      const wsUrl = new URL(endpoint);
      const httpUrl = `http://${wsUrl.host}/json/version`;

      const response = await fetch(httpUrl, {
        signal: AbortSignal.timeout(5000) // 5 segundos de timeout
      });

      if (!response.ok) {
        throw new Error(`Endpoint não respondeu (HTTP ${response.status})`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout na conexão (5s)');
      }
      throw error;
    }
  }

  executeSession(config: AppConfig): Promise<{ message: string, pageInfo: any }> {
    return this._fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  createSession(config: AppConfig): Promise<CreateSessionResponse> {
    return this._fetch<CreateSessionResponse>('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  executeCode(sessionId: string, code: string): Promise<ExecuteCodeResponse> {
    return this._fetch<ExecuteCodeResponse>('/api/session/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, code })
    });
  }

  takeScreenshot(sessionId: string): Promise<{ screenshot: string }> {
    return this._fetch('/api/session/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        options: { fullPage: false }
      })
    });
  }
  
  closeSession(sessionId: string): Promise<{ message: string }> {
    return this._fetch(`/api/session/${sessionId}`, {
      method: 'DELETE'
    });
  }

  getDocumentation(): Promise<{ content: string }> {
    return this._fetch('/api/docs');
  }

  // ==========================================
  // MÉTODOS DE GRAVAÇÃO
  // ==========================================

  /**
   * Iniciar gravação para uma sessão
   */
  startRecording(sessionId: string, config?: Partial<RecordingConfig>): Promise<StartRecordingResponse> {
    const payload: StartRecordingPayload = {
      sessionId,
      config: config || {}
    };

    return this._fetch<StartRecordingResponse>('/api/recording/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Parar gravação
   */
  stopRecording(recordingId: string): Promise<StopRecordingResponse> {
    return this._fetch<StopRecordingResponse>('/api/recording/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId })
    });
  }

  /**
   * Pausar/resumir gravação
   */
  pauseRecording(recordingId: string): Promise<PauseRecordingResponse> {
    return this._fetch<PauseRecordingResponse>('/api/recording/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId })
    });
  }

  /**
   * Obter status da gravação para uma sessão
   */
  getRecordingStatus(sessionId: string): Promise<RecordingStatusResponse> {
    return this._fetch<RecordingStatusResponse>(`/api/recording/status/${sessionId}`);
  }

  /**
   * Verificar se há gravação ativa para uma sessão
   */
  async hasActiveRecording(sessionId: string): Promise<boolean> {
    try {
      const status = await this.getRecordingStatus(sessionId);
      return status.isActive;
    } catch (error) {
      console.error('Erro ao verificar gravação ativa:', error);
      return false;
    }
  }

  // ==========================================
  // MÉTODOS DE PREVIEW
  // ==========================================

  /**
   * Capturar screenshot de uma sessão
   */
  captureScreenshot(sessionId: string, options?: { quality?: number; fullPage?: boolean }): Promise<any> {
    return this._fetch(`/api/recording/screenshot/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {})
    });
  }

  /**
   * Obter preview (screenshot rápido) de uma sessão
   */
  getPreview(sessionId: string): Promise<any> {
    return this._fetch(`/api/recording/preview/${sessionId}`);
  }

  /**
   * Obter informações da página atual de uma sessão
   */
  getPageInfo(sessionId: string): Promise<any> {
    return this._fetch(`/api/recording/page-info/${sessionId}`);
  }

  // ==========================================
  // MÉTODOS DE EXPORTAÇÃO
  // ==========================================

  /**
   * Exportar gravação
   */
  exportRecording(recordingId: string, options: any): Promise<any> {
    return this._fetch('/api/recording/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId, options })
    });
  }

  /**
   * Listar gravações disponíveis
   */
  listRecordings(): Promise<any> {
    return this._fetch('/api/recordings');
  }

  /**
   * Obter gravação específica
   */
  getRecording(recordingId: string): Promise<any> {
    return this._fetch(`/api/recording/${recordingId}`);
  }

  // ==========================================
  // MÉTODOS DE REPRODUÇÃO
  // ==========================================

  /**
   * Iniciar reprodução de gravação
   */
  startPlayback(recordingId: string, sessionId: string, config?: any): Promise<any> {
    return this._fetch('/api/recording/playback/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId, sessionId, config })
    });
  }

  /**
   * Controlar reprodução (pause/resume/stop)
   */
  controlPlayback(recordingId: string, action: 'pause' | 'resume' | 'stop'): Promise<any> {
    return this._fetch('/api/recording/playback/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId, action })
    });
  }

  /**
   * Navegar na reprodução
   */
  seekPlayback(recordingId: string, eventIndex: number): Promise<any> {
    return this._fetch('/api/recording/playback/seek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId, eventIndex })
    });
  }

  /**
   * Obter status da reprodução
   */
  getPlaybackStatus(recordingId: string): Promise<any> {
    return this._fetch(`/api/recording/playback/status/${recordingId}`);
  }
}
