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