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