// Informações da página retornadas pela API
export interface PageInfo {
  title: string;
  url: string;
  timestamp?: number;
}

// Resposta da criação de sessão
export interface CreateSessionResponse {
  sessionId: string;
  message: string;
  pageInfo?: PageInfo;
}

// Resposta da execução de código
export interface ExecuteCodeResponse {
  message: string;
  result?: any;
  screenshot?: string;
  pageInfo?: PageInfo;
}

// Resposta genérica da API para erros
export interface ApiErrorResponse {
  error: string;
  details?: any;
  sessionExpired?: boolean;
}
