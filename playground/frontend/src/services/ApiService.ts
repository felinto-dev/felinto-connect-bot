import { AppConfig } from '../types/config';
import { 
  CreateSessionResponse, 
  ExecuteCodeResponse,
  ApiErrorResponse 
} from '../types/api';

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
}
