import {
  RecordingConfig,
  RecordingStats,
  RecordingData,
  RecordingStatus,
  RecordingEvent,
} from './recording.types';
import { PlaybackConfig, PlaybackStatus } from './playback.types';

export interface StartRecordingResponse {
  recordingId: string;
  sessionId: string;
  message: string;
  config: RecordingConfig;
}

export interface StopRecordingResponse {
  recordingId: string;
  message: string;
  stats: RecordingStats;
  recording: RecordingData;
}

export interface PauseRecordingResponse {
  recordingId: string;
  message: string;
  status: RecordingStatus;
  pausedAt?: number;
  resumedAt?: number;
}

export interface RecordingStatusResponse {
  recordingId: string;
  status: RecordingStatus;
  stats: RecordingStats;
  currentEvent?: RecordingEvent;
  isActive: boolean;
}

export interface ScreenshotResponse {
  success: boolean;
  screenshot: string;
  metadata: {
    url: string;
    title: string;
    viewport: { width: number; height: number } | null;
    timestamp: number;
    quality: number;
    fullPage: boolean;
    size: number;
  };
}

export interface PreviewResponse {
  success: boolean;
  preview: string;
  metadata: {
    url: string;
    title: string;
    timestamp: number;
    isPreview: true;
  };
}

export interface PageInfoResponse {
  success: boolean;
  pageInfo: {
    url: string;
    title: string;
    viewport: { width: number; height: number } | null;
    timestamp: number;
    metrics: Record<string, number> | null;
  };
}

export interface ExportRecordingResponse {
  success: boolean;
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

export interface RecordingListItem {
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
}

export interface RecordingListResponse {
  success: boolean;
  recordings: RecordingListItem[];
  total: number;
}

export interface RecordingDetailResponse {
  success: boolean;
  recording: RecordingData;
}

export interface StartPlaybackResponse {
  success: boolean;
  message: string;
  recordingId: string;
  sessionId: string;
  config: PlaybackConfig;
  status: PlaybackStatus;
}

export interface PlaybackControlResponse {
  success: boolean;
  message: string;
  recordingId: string;
  action: string; // 'pause' | 'resume' | 'stop'
  status: PlaybackStatus;
}

export interface PlaybackSeekResponse {
  success: boolean;
  message: string;
  recordingId: string;
  eventIndex: number;
  status: PlaybackStatus;
}

export interface PlaybackStatusResponse {
  success: boolean;
  isActive: boolean;
  status: PlaybackStatus | null; // null when no active playback
}

/**
 * Response do endpoint legacy POST /api/execute
 * Nota: Não inclui sessionId para compatibilidade com frontend antigo
 */
export interface LegacyExecuteResponse {
  success: boolean;
  message: string;
  pageInfo: {
    url: string;
    title: string;
    timestamp: string;
  };
}

/**
 * Response do endpoint GET /api/chrome/check quando Chrome é detectado
 */
export interface ChromeCheckSuccessResponse {
  available: true;
  endpoint: string;          // Ex: 'ws://docker.for.mac.localhost:9222'
  chromeVersion: string;     // Ex: 'Chrome/120.0.6099.109'
  detectedAt: string;        // Endpoint específico onde foi encontrado
}

/**
 * Response do endpoint GET /api/chrome/check quando Chrome NÃO é detectado
 */
export interface ChromeCheckFailureResponse {
  available: false;
  error: string;                    // Última mensagem de erro
  testedEndpoints: string[];        // Lista de endpoints testados
  instructions: string;             // Comando específico por plataforma
  troubleshooting: string[];        // Passos de troubleshooting
}

/**
 * Union type para response do /api/chrome/check
 */
export type ChromeCheckResponse = ChromeCheckSuccessResponse | ChromeCheckFailureResponse;

/**
 * Response do endpoint GET /api/docs
 */
export interface DocumentationResponse {
  content: string;        // HTML convertido do Markdown
  markdown: string;       // Conteúdo raw do README.md
  lastModified: string;   // Timestamp ISO
}

/**
 * Response de erro do endpoint GET /api/docs
 */
export interface DocumentationErrorResponse {
  error: string;          // 'Não foi possível carregar a documentação'
  details: string;        // Mensagem técnica do erro
}