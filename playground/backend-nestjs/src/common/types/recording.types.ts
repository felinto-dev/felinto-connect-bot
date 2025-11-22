export enum RecordingEventTypeEnum {
  CLICK = 'click',
  TYPE = 'type',
  NAVIGATION = 'navigation',
  KEY_PRESS = 'key_press',
  FORM_SUBMIT = 'form_submit',
  FORM_FOCUS = 'form_focus',
  FORM_INPUT_CHANGE = 'form_input_change',
  FORM_NAVIGATION = 'form_navigation',
  SCREENSHOT = 'screenshot',
  PAGE_LOAD = 'page_load'
}

export type RecordingEventType =
  | RecordingEventTypeEnum.CLICK
  | RecordingEventTypeEnum.TYPE
  | RecordingEventTypeEnum.NAVIGATION
  | RecordingEventTypeEnum.KEY_PRESS
  | RecordingEventTypeEnum.FORM_SUBMIT
  | RecordingEventTypeEnum.FORM_FOCUS
  | RecordingEventTypeEnum.FORM_INPUT_CHANGE
  | RecordingEventTypeEnum.FORM_NAVIGATION
  | RecordingEventTypeEnum.SCREENSHOT
  | RecordingEventTypeEnum.PAGE_LOAD;

export enum RecordingModeEnum {
  SMART = 'smart',
  DETAILED = 'detailed',
  MINIMAL = 'minimal'
}

export type RecordingMode = 'smart' | 'detailed' | 'minimal';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

export interface RecordingConfig {
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