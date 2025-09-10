// ==========================================
// UTILITÁRIOS PARA SISTEMA DE GRAVAÇÃO
// ==========================================

import type { 
  RecordingEvent, 
  RecordingEventType, 
  RecordingData,
  RecordingStats,
  EventFilters,
  FilteredEvents
} from '../types/recording';

import { EVENT_ICONS, EVENT_COLORS, EVENT_TYPE_DESCRIPTIONS } from '../constants/recording';

/**
 * Formatar tempo em formato legível (mm:ss)
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Formatar timestamp em formato legível
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 1
  });
}

/**
 * Calcular tempo relativo desde o início da gravação
 */
export function calculateRelativeTime(eventTimestamp: number, startTime: number): number {
  return eventTimestamp - startTime;
}

/**
 * Obter ícone para um tipo de evento
 */
export function getEventIcon(eventType: RecordingEventType): string {
  const ICON_MAP: Record<RecordingEventType, string> = {
    click: 'mouse-pointer',
    type: 'keyboard',
    navigation: 'navigation',
    scroll: 'scroll',
    hover: 'move',
    key_press: 'command',
    form_submit: 'send',
    form_focus: 'focus',
    form_input_change: 'edit-3',
    form_navigation: 'corner-down-right',
    screenshot: 'camera',
    wait: 'clock',
    page_load: 'refresh-cw',
  };
  return ICON_MAP[eventType] || 'help-circle';
}

/**
 * Obter cor para um tipo de evento
 */
export function getEventColor(eventType: RecordingEventType): string {
  const COLOR_MAP: Record<string, string> = {
    click: 'blue',
    type: 'green',
    navigation: 'purple',
    scroll: 'gray',
    hover: 'yellow',
    key_press: 'indigo',
    form_submit: 'green',
    form_focus: 'blue',
    form_input_change: 'green',
    form_navigation: 'indigo',
    screenshot: 'orange',
    wait: 'gray',
    page_load: 'red',
  };
  return COLOR_MAP[eventType] || 'gray';
}

/**
 * Obter descrição para tipo de evento
 */
export function getEventDescription(eventType: RecordingEventType): string {
  return EVENT_TYPE_DESCRIPTIONS[eventType] || 'Evento desconhecido';
}

/**
 * Gerar ID único para evento
 */
export function generateEventId(): string {
  return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gerar ID único para gravação
 */
export function generateRecordingId(): string {
  return `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calcular estatísticas de uma gravação
 */
export function calculateRecordingStats(recording: RecordingData): RecordingStats {
  const events = recording.events;
  const totalEvents = events.length;
  
  // Contar eventos por tipo
  const eventsByType: Record<RecordingEventType, number> = {
    'click': 0,
    'type': 0,
    'navigation': 0,
    'scroll': 0,
    'hover': 0,
    'wait': 0,
    'screenshot': 0,
    'page_load': 0,
    'form_submit': 0,
    'key_press': 0
  };
  
  let screenshotCount = 0;
  
  events.forEach(event => {
    eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    if (event.screenshot) {
      screenshotCount++;
    }
  });
  
  // Calcular duração e intervalo médio
  const duration = recording.duration || 0;
  const averageEventInterval = totalEvents > 1 ? duration / (totalEvents - 1) : 0;
  
  return {
    totalEvents,
    eventsByType,
    duration,
    averageEventInterval,
    screenshotCount
  };
}


/**
 * Filtrar eventos baseado em critérios
 */
export function filterEvents(events: RecordingEvent[], filters: EventFilters): FilteredEvents {
  let filteredEvents = [...events];
  
  // Filtrar por tipos de evento
  if (filters.types.size > 0) {
    filteredEvents = filteredEvents.filter(event => filters.types.has(event.type));
  }
  
  // Filtrar por intervalo de tempo
  if (filters.timeRange) {
    filteredEvents = filteredEvents.filter(event => 
      event.timestamp >= filters.timeRange!.start && 
      event.timestamp <= filters.timeRange!.end
    );
  }
  
  // Filtrar por texto de busca
  if (filters.searchText) {
    const searchLower = filters.searchText.toLowerCase();
    filteredEvents = filteredEvents.filter(event => 
      event.type.toLowerCase().includes(searchLower) ||
      event.selector?.toLowerCase().includes(searchLower) ||
      event.value?.toLowerCase().includes(searchLower) ||
      event.url?.toLowerCase().includes(searchLower)
    );
  }
  
  // Filtrar por presença de screenshot
  if (filters.hasScreenshot !== undefined) {
    filteredEvents = filteredEvents.filter(event => 
      filters.hasScreenshot ? !!event.screenshot : !event.screenshot
    );
  }
  
  // Filtrar por duração mínima
  if (filters.minDuration !== undefined) {
    filteredEvents = filteredEvents.filter(event => 
      (event.duration || 0) >= filters.minDuration!
    );
  }
  
  return {
    events: filteredEvents,
    totalCount: events.length,
    filteredCount: filteredEvents.length,
    filters
  };
}

/**
 * Validar seletor CSS
 */
export function isValidSelector(selector: string): boolean {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gerar seletor único para elemento
 */
export function generateUniqueSelector(element: Element): string {
  // Tentar ID primeiro
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Tentar combinação de tag + classes
  const tagName = element.tagName.toLowerCase();
  const classes = Array.from(element.classList).slice(0, 3).join('.');
  
  if (classes) {
    const selector = `${tagName}.${classes}`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }
  
  // Fallback para xpath-like selector
  const path: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.body) {
    const tagName = current.tagName.toLowerCase();
    const siblings = Array.from(current.parentElement?.children || [])
      .filter(el => el.tagName === current!.tagName);
    
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      path.unshift(`${tagName}:nth-of-type(${index})`);
    } else {
      path.unshift(tagName);
    }
    
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

/**
 * Mascarar valores sensíveis (DESABILITADO - captura completa)
 */
export function maskSensitiveValue(value: string, fieldType?: string): string {
  // Retorna o valor completo sem mascaramento
  // Todas as informações digitadas são capturadas integralmente
  return value || '';
}

/**
 * Calcular tamanho de screenshot em KB
 */
export function calculateScreenshotSize(base64Data: string): number {
  // Remove data URL prefix se presente
  const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  
  // Calcula tamanho aproximado em bytes
  const bytes = (base64.length * 3) / 4;
  
  // Converte para KB
  return Math.round(bytes / 1024);
}

/**
 * Comprimir screenshot se necessário
 */
export function compressScreenshot(
  base64Data: string, 
  maxSizeKB: number, 
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Redimensionar se necessário
      let { width, height } = img;
      const currentSizeKB = calculateScreenshotSize(base64Data);
      
      if (currentSizeKB > maxSizeKB) {
        const ratio = Math.sqrt(maxSizeKB / currentSizeKB);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Converter de volta para base64 com qualidade ajustada
      const compressedData = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedData);
    };
    
    img.src = base64Data;
  });
}

/**
 * Debounce para eventos frequentes
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle para eventos muito frequentes
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Truncar URL para exibição
 */
export function truncateUrl(url: string, maxLength: number = 60): string {
  if (!url || url.length <= maxLength) return url;
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    const params = urlObj.search;
    
    // Se apenas o domínio + path já é muito longo
    if ((domain + path).length > maxLength - 10) {
      return `${domain}${path.substring(0, maxLength - domain.length - 10)}...`;
    }
    
    // Se tem parâmetros, truncar os parâmetros
    if (params) {
      const availableForParams = maxLength - domain.length - path.length - 3; // 3 para "..."
      if (availableForParams > 10) {
        return `${domain}${path}${params.substring(0, availableForParams)}...`;
      } else {
        return `${domain}${path}...`;
      }
    }
    
    return url;
  } catch (error) {
    // Se não é URL válida, truncar simples
    return url.length > maxLength ? `${url.substring(0, maxLength - 3)}...` : url;
  }
}

/**
 * Truncar texto genérico para exibição
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Truncar seletor CSS para exibição
 */
export function truncateSelector(selector: string, maxLength: number = 40): string {
  if (!selector || selector.length <= maxLength) return selector;
  
  // Tentar manter a parte mais importante (última classe ou ID)
  const parts = selector.split(' ');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.length <= maxLength) {
      return `...${lastPart}`;
    }
  }
  
  return `${selector.substring(0, maxLength - 3)}...`;
}
