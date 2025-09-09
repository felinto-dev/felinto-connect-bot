// ==========================================
// TIPOS FRONTEND PARA SISTEMA DE GRAVAÇÃO
// ==========================================

// Re-exportar tipos do backend que são usados no frontend
export type RecordingEventType = 
  | 'click' 
  | 'type' 
  | 'navigation' 
  | 'scroll' 
  | 'hover' 
  | 'wait' 
  | 'screenshot'
  | 'page_load'
  | 'form_submit'
  | 'key_press';

export type RecordingMode = 'smart' | 'detailed' | 'minimal';
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

// Configurações de gravação (frontend)
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

// Evento de gravação (frontend)
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

// Dados completos da gravação (frontend)
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

// Estatísticas da gravação (frontend)
export interface RecordingStats {
  totalEvents: number;
  eventsByType: Record<RecordingEventType, number>;
  duration: number;
  averageEventInterval: number;
  screenshotCount: number;
}

// Configurações de UI para gravação
export interface RecordingUIConfig {
  selectedEvents: Set<RecordingEventType>;
  mode: RecordingMode;
  delay: number;
  autoScreenshot: boolean;
  screenshotInterval: number; // 0 = desativado, screenshots apenas em eventos específicos
}

// Estado da UI de gravação
export interface RecordingUIState {
  isRecording: boolean;
  isPaused: boolean;
  recordingId?: string;
  sessionId?: string;
  startTime?: Date;
  elapsedTime: number;
  eventCount: number;
  lastEventTime?: Date;
  currentStatus: RecordingStatus;
  error?: string;
}

// Configurações para timeline
export interface TimelineConfig {
  showEventTypes: Set<RecordingEventType>;
  groupByType: boolean;
  showTimestamps: boolean;
  showScreenshots: boolean;
  zoomLevel: number;
}

// Item da timeline
export interface TimelineItem {
  event: RecordingEvent;
  displayTime: string;
  relativeTime: number;
  isVisible: boolean;
  cssClass: string;
}

// Configurações para preview
export interface PreviewConfig {
  autoRefresh: boolean;
  refreshInterval: number;
  showCursor: boolean;
  highlightElements: boolean;
  fullscreen: boolean;
  smartRefresh: boolean; // Só faz refresh quando página em foco e cursor sobre preview
}

// Estado do preview
export interface PreviewState {
  isActive: boolean;
  currentUrl?: string;
  lastScreenshot?: string;
  lastUpdate?: Date;
  error?: string;
  isPageFocused: boolean; // Se a página está em foco
  isCursorOverPreview: boolean; // Se o cursor está sobre a área do preview
}

// Configurações para reprodução
export interface PlaybackConfig {
  speed: number;
  pauseOnError: boolean;
  skipScreenshots: boolean;
  startFromEvent?: number;
  endAtEvent?: number;
}

// Estado da reprodução
export interface PlaybackState {
  isPlaying: boolean;
  currentEventIndex: number;
  totalEvents: number;
  elapsedTime: number;
  remainingTime: number;
  speed: number;
  error?: string;
}

// Opções de exportação (frontend)
export interface ExportOptions {
  format: 'json' | 'puppeteer' | 'playwright' | 'selenium';
  includeScreenshots: boolean;
  minifyOutput: boolean;
  addComments: boolean;
  filename?: string;
}

// Configurações de conexão
export interface ConnectionStatus {
  chrome: {
    connected: boolean;
    endpoint?: string;
    version?: string;
    error?: string;
  };
  playground: {
    configured: boolean;
    sessionId?: string;
    error?: string;
  };
  websocket: {
    connected: boolean;
    url?: string;
    error?: string;
  };
}

// Mensagens WebSocket para gravação
export interface RecordingWebSocketMessage {
  type: 'recording_event' | 'recording_status' | 'recording_error';
  recordingId: string;
  sessionId: string;
  data: RecordingEvent | RecordingStats | { error: string };
  timestamp: number;
}

// Eventos customizados do DOM
export interface RecordingDOMEvent extends Event {
  recordingData?: {
    type: RecordingEventType;
    selector?: string;
    value?: string;
    coordinates?: { x: number; y: number };
  };
}

// Configurações avançadas de captura
export interface CaptureSettings {
  debounceTime: number; // ms para debounce de eventos
  ignoreSelectors: string[]; // seletores a ignorar
  sensitiveFields: string[]; // campos sensíveis para mascarar
  customEvents: string[]; // eventos customizados para capturar
  screenshotQuality: number; // qualidade do screenshot (0-1)
  maxScreenshotSize: number; // tamanho máximo em KB
}

// Filtros para eventos
export interface EventFilters {
  types: Set<RecordingEventType>;
  timeRange?: {
    start: number;
    end: number;
  };
  searchText?: string;
  hasScreenshot?: boolean;
  minDuration?: number;
}

// Resultado de busca/filtro
export interface FilteredEvents {
  events: RecordingEvent[];
  totalCount: number;
  filteredCount: number;
  filters: EventFilters;
}
