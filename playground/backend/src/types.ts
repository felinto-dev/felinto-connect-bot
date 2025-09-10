import type { Page } from 'puppeteer';

// Tipagem para a função de broadcast do WebSocket
export type BroadcastFn = (message: BroadcastMessage) => void;

// Interface para as mensagens enviadas via WebSocket
export interface BroadcastMessage {
  type: 'info' | 'success' | 'warning' | 'error' | 'log' | 'session_expired' | 'recording_event' | 'recording_status';
  message: string;
  data?: unknown;
  sessionId?: string;
  recordingId?: string;
}

// Configuração para criar uma nova sessão do Puppeteer
export interface SessionConfig {
  browserWSEndpoint: string;
  $debug?: boolean;
  [key: string]: unknown; // Permite outras propriedades
}

// Estrutura de dados para uma sessão ativa
export interface SessionData {
  id: string;
  page: Page;
  config: SessionConfig;
  createdAt: Date;
  lastUsed: Date;
  executionCount: number;
}

// Informações sobre a página Puppeteer
export interface PageInfo {
  url: string;
  title: string;
  timestamp: string;
  error?: string;
}

// Resultado da execução de um código na sessão
export interface ExecutionResult {
  result: unknown;
  pageInfo: PageInfo;
}

// Estatísticas das sessões ativas
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalExecutions: number;
  oldestSession: number | null;
}

// ==========================================
// TIPOS PARA SISTEMA DE GRAVAÇÃO
// ==========================================

// Tipos de eventos que podem ser gravados
export type RecordingEventType =
  | 'click'
  | 'type'
  | 'navigation'
  | 'key_press'
  | 'form_submit'
  | 'form_focus' // Foco em um campo de formulário
  | 'form_input_change' // Mudança de valor em um campo (após digitação)
  | 'form_navigation' // Navegação entre campos (ex: Tab)
  | 'screenshot'
  | 'page_load'
  | 'form_submit'
  | 'key_press';

// Modos de gravação disponíveis
export type RecordingMode = 'smart' | 'detailed' | 'minimal';

// Status da gravação
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

// Configurações de gravação
export interface RecordingConfig {
  sessionId: string;
  events: RecordingEventType[];
  mode: RecordingMode;
  delay: number; // ms entre ações
  captureScreenshots: boolean;
  screenshotInterval?: number; // ms - 0 = desativado (screenshots apenas em eventos)
  maxDuration?: number; // ms
  maxEvents?: number;
}

// Dados de um evento gravado
export interface RecordingEvent {
  id: string;
  type: RecordingEventType;
  timestamp: number;
  selector?: string;
  value?: string;
  coordinates?: { x: number; y: number };
  url?: string;
  screenshot?: string; // base64
  metadata?: Record<string, unknown>;
  duration?: number; // para eventos com duração
}

// Dados de uma gravação completa
export interface RecordingData {
  id: string;
  sessionId: string;
  config: RecordingConfig;
  events: RecordingEvent[];
  startTime: number;
  endTime?: number;
  duration?: number;
  status: RecordingStatus;
  metadata: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    initialUrl?: string;
    totalEvents: number;
    totalScreenshots: number;
  };
}

// Estatísticas de uma gravação
export interface RecordingStats {
  totalEvents: number;
  eventsByType: Record<RecordingEventType, number>;
  duration: number;
  averageEventInterval: number;
  screenshotCount: number;
}

// Configurações para reprodução
export interface PlaybackConfig {
  speed: number; // multiplicador de velocidade (0.5, 1, 1.5, 2)
  pauseOnError: boolean;
  skipScreenshots: boolean;
  startFromEvent?: number;
  endAtEvent?: number;
}

// Status da reprodução
export interface PlaybackStatus {
  isPlaying: boolean;
  currentEventIndex: number;
  totalEvents: number;
  elapsedTime: number;
  remainingTime: number;
  speed: number;
}

// Resposta da API para iniciar gravação
export interface StartRecordingResponse {
  recordingId: string;
  sessionId: string;
  message: string;
  config: RecordingConfig;
}

// Resposta da API para parar gravação
export interface StopRecordingResponse {
  recordingId: string;
  message: string;
  stats: RecordingStats;
  recording: RecordingData;
}

// Resposta da API para pausar gravação
export interface PauseRecordingResponse {
  recordingId: string;
  message: string;
  status: RecordingStatus;
  pausedAt?: number;
  resumedAt?: number;
}

// Resposta da API para status da gravação
export interface RecordingStatusResponse {
  recordingId: string;
  status: RecordingStatus;
  stats: RecordingStats;
  currentEvent?: RecordingEvent;
  isActive: boolean;
}

// Opções para exportação
export interface ExportOptions {
  format: 'json' | 'puppeteer' | 'playwright' | 'selenium';
  includeScreenshots: boolean;
  minifyOutput: boolean;
  addComments: boolean;
}

// Resultado da exportação
export interface ExportResult {
  format: string;
  content: string;
  filename: string;
  size: number;
  metadata: {
    exportedAt: number;
    originalRecordingId: string;
    eventCount: number;
  };
}
