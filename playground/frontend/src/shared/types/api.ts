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

// ==========================================
// TIPOS DE API PARA GRAVAÇÃO
// ==========================================

import type { 
  RecordingConfig, 
  RecordingData, 
  RecordingStats, 
  RecordingStatus,
  ExportOptions 
} from './recording';

// Resposta para iniciar gravação
export interface StartRecordingResponse {
  success: boolean;
  recordingId: string;
  sessionId: string;
  message: string;
  config: RecordingConfig;
}

// Resposta para parar gravação
export interface StopRecordingResponse {
  success: boolean;
  recordingId: string;
  message: string;
  stats: RecordingStats;
  recording: RecordingData;
}

// Resposta para pausar/resumir gravação
export interface PauseRecordingResponse {
  success: boolean;
  recordingId: string;
  message: string;
  status: RecordingStatus;
  pausedAt?: number;
  resumedAt?: number;
}

// Resposta para status da gravação
export interface RecordingStatusResponse {
  success: boolean;
  recordingId: string;
  status: RecordingStatus;
  stats: RecordingStats;
  currentEvent?: any;
  isActive: boolean;
}

// Resposta para listar gravações
export interface ListRecordingsResponse {
  success: boolean;
  recordings: Array<{
    id: string;
    sessionId: string;
    createdAt: number;
    duration?: number;
    eventCount: number;
    status: RecordingStatus;
    metadata: {
      initialUrl?: string;
      totalEvents: number;
    };
  }>;
  total: number;
}

// Resposta para obter gravação específica
export interface GetRecordingResponse {
  success: boolean;
  recording: RecordingData;
}

// Resposta para exportar gravação
export interface ExportRecordingResponse {
  success: boolean;
  format: string;
  content: string;
  filename: string;
  size: number;
  downloadUrl?: string;
}

// Resposta para importar gravação
export interface ImportRecordingResponse {
  success: boolean;
  recordingId: string;
  message: string;
  eventCount: number;
  warnings?: string[];
}

// Resposta para deletar gravação
export interface DeleteRecordingResponse {
  success: boolean;
  message: string;
  recordingId: string;
}

// Payload para iniciar gravação
export interface StartRecordingPayload {
  sessionId: string;
  config: Partial<RecordingConfig>;
}

// Payload para configurar gravação
export interface ConfigureRecordingPayload {
  recordingId: string;
  config: Partial<RecordingConfig>;
}

// Payload para exportar gravação
export interface ExportRecordingPayload {
  recordingId: string;
  options: ExportOptions;
}

// Payload para importar gravação
export interface ImportRecordingPayload {
  sessionId: string;
  data: string | RecordingData;
  format: 'json' | 'auto';
  overwrite?: boolean;
}
