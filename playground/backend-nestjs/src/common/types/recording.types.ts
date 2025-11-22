/**
 * Recording event types - aligned with Express backend types.ts
 * Note: The Express backend contains duplicate values ('form_submit' and 'key_press' appear twice)
 * to maintain 1:1 compatibility. The set of unique values is identical.
 */
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

/**
 * Recording event types - matches Express backend exactly including duplicates for 1:1 compatibility
 * The duplicate entries ('form_submit' and 'key_press') are preserved to maintain identical structure
 * to the Express backend types.ts file. Functionally, this has no impact as they represent the same values.
 */
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
  | 'form_submit' // Duplicate maintained for 1:1 compatibility with Express backend
  | 'key_press'; // Duplicate maintained for 1:1 compatibility with Express backend

export enum RecordingModeEnum {
  SMART = 'smart',
  DETAILED = 'detailed',
  MINIMAL = 'minimal'
}

export type RecordingMode = 'smart' | 'detailed' | 'minimal';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

/**
 * Recording configuration settings
 * Note: sessionId is intentionally NOT included here as it belongs to RecordingData
 * and the input DTOs (StartRecordingDto), not the configuration itself.
 * This aligns with the Express backend domain model where sessionId is
 * session-level metadata, not part of the recording configuration.
 */
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