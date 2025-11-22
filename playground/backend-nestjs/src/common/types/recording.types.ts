export type RecordingEventType =
  | 'click'
  | 'type'
  | 'navigation'
  | 'key_press'
  | 'form_submit'
  | 'form_focus'
  | 'form_input_change'
  | 'form_navigation'
  | 'form'
  | 'screenshot'
  | 'page_load';

export type RecordingMode = 'smart' | 'detailed' | 'minimal';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

export interface RecordingConfig {
  sessionId: string;
  events: RecordingEventType[];
  mode: RecordingMode;
  delay: number;
  captureScreenshots: boolean;
  screenshotInterval?: number;
  maxDuration?: number;
  maxEvents?: number;
}

export interface RecordingEvent {
  id: string;
  type: RecordingEventType;
  timestamp: number;
  selector?: string;
  value?: string;
  coordinates?: { x: number; y: number };
  url?: string;
  screenshot?: string;
  metadata?: Record<string, unknown>;
  duration?: number;
}

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

export interface RecordingStats {
  totalEvents: number;
  eventsByType: Record<RecordingEventType, number>;
  duration: number;
  averageEventInterval: number;
  screenshotCount: number;
}