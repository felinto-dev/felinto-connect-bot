export type BroadcastFn = (message: BroadcastMessage) => void;

export interface BroadcastMessage {
  type: 'info' | 'success' | 'warning' | 'error' | 'log' | 'session_expired' | 'recording_event' | 'recording_status';
  message: string;
  data?: unknown;
  sessionId?: string;
  recordingId?: string;
}