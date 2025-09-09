// ==========================================
// CONSTANTES PARA SISTEMA DE GRAVAÇÃO
// ==========================================

import type { 
  RecordingEventType, 
  RecordingMode, 
  RecordingUIConfig,
  CaptureSettings,
  PreviewConfig 
} from '../types/recording';

// Eventos padrão selecionados
export const DEFAULT_SELECTED_EVENTS: Set<RecordingEventType> = new Set([
  'click',
  'type', 
  'navigation',
  'wait'
]);

// Todos os eventos disponíveis
export const ALL_RECORDING_EVENTS: RecordingEventType[] = [
  'click',
  'type',
  'navigation', 
  'scroll',
  'hover',
  'wait',
  'screenshot',
  'page_load',
  'form_submit',
  'key_press'
];

// Configurações padrão de gravação
export const DEFAULT_RECORDING_CONFIG: RecordingUIConfig = {
  selectedEvents: DEFAULT_SELECTED_EVENTS,
  mode: 'smart' as RecordingMode,
  delay: 500,
  autoScreenshot: false,
  screenshotInterval: 0 // 0 significa sem screenshots automáticos por intervalo
};

// URL padrão para gravação
export const DEFAULT_RECORDING_URL = 'https://twitter.com/login';

// Configurações padrão de captura
export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  debounceTime: 100,
  ignoreSelectors: [
    '[data-recording-ignore]',
    '.recording-controls',
    '.recording-status',
    '.modal-overlay'
  ],
  sensitiveFields: [
    'input[type="password"]',
    'input[name*="password"]',
    'input[name*="secret"]',
    'input[name*="token"]'
  ],
  customEvents: [],
  screenshotQuality: 0.8,
  maxScreenshotSize: 500 // KB
};


// Configurações padrão do preview
export const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  autoRefresh: true,
  refreshInterval: 2000,
  showCursor: true,
  highlightElements: true,
  fullscreen: false,
  smartRefresh: true // Sempre ativo para economizar recursos
};

// Limites do sistema
export const RECORDING_LIMITS = {
  MAX_EVENTS: 10000,
  MAX_DURATION: 3600000, // 1 hora em ms
  MAX_SCREENSHOT_SIZE: 1024, // KB
  MIN_DELAY: 0,
  MAX_DELAY: 10000,
  MIN_SCREENSHOT_INTERVAL: 0, // 0 = desativado (screenshots apenas em eventos)
  MAX_SCREENSHOT_INTERVAL: 0 // Desativado - screenshots são baseados em eventos
};

// Velocidades de reprodução disponíveis
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];

// Formatos de exportação disponíveis
export const EXPORT_FORMATS = [
  { value: 'json', label: 'JSON', description: 'Formato nativo do sistema' },
  { value: 'puppeteer', label: 'Puppeteer Script', description: 'Script JavaScript para Puppeteer' },
  { value: 'playwright', label: 'Playwright Script', description: 'Script JavaScript para Playwright' },
  { value: 'selenium', label: 'Selenium Script', description: 'Script para Selenium WebDriver' }
];

// Ícones para tipos de eventos
export const EVENT_ICONS: Record<RecordingEventType, string> = {
  'click': 'mouse-pointer',
  'type': 'keyboard', 
  'navigation': 'navigation',
  'scroll': 'scroll',
  'hover': 'move',
  'wait': 'clock',
  'screenshot': 'camera',
  'page_load': 'refresh-cw',
  'form_submit': 'send',
  'key_press': 'command'
};

// Cores para tipos de eventos (classes CSS)
export const EVENT_COLORS: Record<RecordingEventType, string> = {
  'click': 'event-click',
  'type': 'event-type',
  'navigation': 'event-navigation', 
  'scroll': 'event-scroll',
  'hover': 'event-hover',
  'wait': 'event-wait',
  'screenshot': 'event-screenshot',
  'page_load': 'event-page-load',
  'form_submit': 'event-form-submit',
  'key_press': 'event-key-press'
};

// Descrições dos modos de gravação
export const RECORDING_MODE_DESCRIPTIONS: Record<RecordingMode, string> = {
  'smart': 'Otimiza automaticamente as ações gravadas, removendo redundâncias',
  'detailed': 'Grava todas as ações sem otimização, máximo de detalhes',
  'minimal': 'Grava apenas ações essenciais, foco na eficiência'
};

// Descrições dos tipos de eventos
export const EVENT_TYPE_DESCRIPTIONS: Record<RecordingEventType, string> = {
  'click': 'Cliques do mouse em elementos da página',
  'type': 'Digitação em campos de texto e formulários',
  'navigation': 'Mudanças de URL e navegação entre páginas',
  'scroll': 'Rolagem da página ou elementos específicos',
  'hover': 'Movimento do mouse sobre elementos (hover)',
  'wait': 'Pausas e esperas durante a navegação',
  'screenshot': 'Capturas de tela automáticas ou manuais',
  'page_load': 'Carregamento completo de páginas',
  'form_submit': 'Envio de formulários',
  'key_press': 'Teclas especiais (Enter, Tab, Esc, etc.)'
};

// Mensagens de status
export const STATUS_MESSAGES = {
  IDLE: 'Pronto para iniciar gravação',
  RECORDING: 'Gravando ações...',
  PAUSED: 'Gravação pausada',
  STOPPED: 'Gravação finalizada',
  ERROR: 'Erro na gravação'
};

// Configurações de WebSocket
export const WEBSOCKET_CONFIG = {
  RECONNECT_INTERVAL: 3000,
  MAX_RECONNECT_ATTEMPTS: 10,
  HEARTBEAT_INTERVAL: 30000,
  MESSAGE_TIMEOUT: 5000
};

// Configurações de API
export const API_CONFIG = {
  ENDPOINTS: {
    START_RECORDING: '/api/recording/start',
    STOP_RECORDING: '/api/recording/stop',
    PAUSE_RECORDING: '/api/recording/pause',
    STATUS_RECORDING: '/api/recording/status',
    LIST_RECORDINGS: '/api/recordings',
    GET_RECORDING: '/api/recording',
    EXPORT_RECORDING: '/api/recording/export',
    DELETE_RECORDING: '/api/recording'
  },
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3
};
