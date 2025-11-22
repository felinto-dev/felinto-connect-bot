import {
  RecordingConfig,
  RecordingStats,
  RecordingData,
  RecordingStatus,
  RecordingEvent,
} from './recording.types';

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
    metrics: {
      Timestamp?: number;
      Documents?: number;
      Frames?: number;
      JSEventListeners?: number;
      Nodes?: number;
      LayoutCount?: number;
      RecalcStyleCount?: number;
      LayoutDuration?: number;
      RecalcStyleDuration?: number;
      ScriptDuration?: number;
      TaskDuration?: number;
      JSHeapUsedSize?: number;
      JSHeapTotalSize?: number;
    } | null;
  };
}