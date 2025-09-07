import type { SharedServices } from '../shared';
import type { 
  RecordingEvent,
  TimelineItem,
  TimelineConfig,
  PlaybackConfig,
  PlaybackState,
  RecordingEventType
} from '../shared/types/recording';
import { 
  eventsToTimelineItems,
  getEventIcon,
  getEventColor,
  formatTimestamp,
  formatDuration
} from '../shared/utils/recording';
import { 
  DEFAULT_TIMELINE_CONFIG,
  PLAYBACK_SPEEDS,
  ALL_RECORDING_EVENTS
} from '../shared/constants/recording';

export class TimelineManager {
  private sharedServices: SharedServices;
  private config: TimelineConfig;
  private playbackConfig: PlaybackConfig;
  private playbackState: PlaybackState;
  private events: RecordingEvent[] = [];
  private timelineItems: TimelineItem[] = [];
  private playbackTimer: number | null = null;
  private startTime: number = 0;
  private onEventPlayback?: (event: RecordingEvent, index: number) => void;

  constructor(sharedServices: SharedServices) {
    this.sharedServices = sharedServices;
    
    // Configuração padrão da timeline
    this.config = { ...DEFAULT_TIMELINE_CONFIG };

    // Configuração padrão de reprodução
    this.playbackConfig = {
      speed: 1,
      pauseOnError: true,
      skipScreenshots: false,
      startFromEvent: undefined,
      endAtEvent: undefined
    };

    // Estado inicial da reprodução
    this.playbackState = {
      isPlaying: false,
      currentEventIndex: -1,
      totalEvents: 0,
      elapsedTime: 0,
      remainingTime: 0,
      speed: 1
    };
  }

  /**
   * Inicializar timeline manager
   */
  public init(): void {
    this.setupEventListeners();
    this.initializeUI();
  }

  /**
   * Configurar event listeners
   */
  private setupEventListeners(): void {
    // Controles de reprodução
    document.getElementById('playTimelineBtn')?.addEventListener('click', () => {
      this.playTimeline();
    });

    document.getElementById('pauseTimelineBtn')?.addEventListener('click', () => {
      this.pauseTimeline();
    });

    document.getElementById('stopTimelineBtn')?.addEventListener('click', () => {
      this.stopTimeline();
    });

    // Controle de velocidade
    const speedSelect = document.getElementById('timelineSpeed') as HTMLSelectElement;
    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        const speed = parseFloat((e.target as HTMLSelectElement).value);
        this.setPlaybackSpeed(speed);
      });
    }

    // Filtros de eventos
    const eventFilters = document.querySelectorAll('input[data-timeline-filter]');
    eventFilters.forEach(filter => {
      filter.addEventListener('change', () => {
        this.updateEventFilters();
      });
    });

    // Slider de progresso (se existir)
    const progressSlider = document.getElementById('timelineProgress') as HTMLInputElement;
    if (progressSlider) {
      progressSlider.addEventListener('input', (e) => {
        const progress = parseInt((e.target as HTMLInputElement).value);
        this.seekToProgress(progress);
      });
    }
  }

  /**
   * Inicializar UI
   */
  private initializeUI(): void {
    this.updatePlaybackControls();
    this.updateTimelineDisplay();
    this.setupEventFilters();
  }

  /**
   * Configurar filtros de eventos
   */
  private setupEventFilters(): void {
    // Criar checkboxes para filtros se não existirem
    const filtersContainer = document.getElementById('timelineFilters');
    if (filtersContainer && filtersContainer.children.length === 0) {
      ALL_RECORDING_EVENTS.forEach(eventType => {
        const label = document.createElement('label');
        label.className = 'timeline-filter-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.config.showEventTypes.has(eventType);
        checkbox.setAttribute('data-timeline-filter', eventType);
        
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', getEventIcon(eventType));
        icon.className = 'filter-icon';
        
        const text = document.createElement('span');
        text.textContent = eventType;
        
        label.appendChild(checkbox);
        label.appendChild(icon);
        label.appendChild(text);
        filtersContainer.appendChild(label);
      });

      // Reinicializar ícones Lucide
      if (typeof window.lucide !== 'undefined') {
        window.lucide.createIcons();
      }
    }
  }

  /**
   * Definir eventos para a timeline
   */
  public setEvents(events: RecordingEvent[], startTime: number): void {
    this.events = [...events];
    this.startTime = startTime;
    this.playbackState.totalEvents = events.length;
    
    // Resetar reprodução
    this.stopTimeline();
    
    // Regenerar items da timeline
    this.regenerateTimelineItems();
    
    // Atualizar UI
    this.updateTimelineDisplay();
    this.updatePlaybackControls();
    
    console.log(`📊 Timeline atualizada: ${events.length} eventos`);
  }

  /**
   * Regenerar items da timeline baseado nos filtros
   */
  private regenerateTimelineItems(): void {
    this.timelineItems = eventsToTimelineItems(this.events, this.startTime, {
      showEventTypes: this.config.showEventTypes
    });
  }

  /**
   * Iniciar reprodução da timeline
   */
  public playTimeline(): void {
    if (this.events.length === 0) {
      console.warn('⚠️ Nenhum evento para reproduzir');
      return;
    }

    if (this.playbackState.isPlaying) {
      this.pauseTimeline();
      return;
    }

    this.playbackState.isPlaying = true;
    this.playbackState.speed = this.playbackConfig.speed;

    // Se estava no final, reiniciar
    if (this.playbackState.currentEventIndex >= this.events.length - 1) {
      this.playbackState.currentEventIndex = this.playbackConfig.startFromEvent || -1;
      this.playbackState.elapsedTime = 0;
    }

    this.startPlaybackTimer();
    this.updatePlaybackControls();

    console.log(`▶️ Reprodução iniciada (velocidade: ${this.playbackState.speed}x)`);
  }

  /**
   * Pausar reprodução da timeline
   */
  public pauseTimeline(): void {
    if (!this.playbackState.isPlaying) return;

    this.playbackState.isPlaying = false;
    this.stopPlaybackTimer();
    this.updatePlaybackControls();

    console.log('⏸️ Reprodução pausada');
  }

  /**
   * Parar reprodução da timeline
   */
  public stopTimeline(): void {
    this.playbackState.isPlaying = false;
    this.playbackState.currentEventIndex = -1;
    this.playbackState.elapsedTime = 0;
    
    this.stopPlaybackTimer();
    this.updatePlaybackControls();
    this.updateTimelineDisplay();

    console.log('⏹️ Reprodução parada');
  }

  /**
   * Definir velocidade de reprodução
   */
  public setPlaybackSpeed(speed: number): void {
    if (!PLAYBACK_SPEEDS.includes(speed)) {
      console.warn(`⚠️ Velocidade inválida: ${speed}`);
      return;
    }

    this.playbackConfig.speed = speed;
    this.playbackState.speed = speed;

    // Reiniciar timer se estiver reproduzindo
    if (this.playbackState.isPlaying) {
      this.stopPlaybackTimer();
      this.startPlaybackTimer();
    }

    this.updateSpeedDisplay();
    console.log(`🎚️ Velocidade alterada para: ${speed}x`);
  }

  /**
   * Navegar para posição específica na timeline
   */
  public seekToProgress(progressPercent: number): void {
    if (this.events.length === 0) return;

    const targetIndex = Math.floor((progressPercent / 100) * this.events.length);
    this.seekToEvent(Math.max(0, Math.min(targetIndex, this.events.length - 1)));
  }

  /**
   * Navegar para evento específico
   */
  public seekToEvent(eventIndex: number): void {
    if (eventIndex < 0 || eventIndex >= this.events.length) return;

    const wasPlaying = this.playbackState.isPlaying;
    
    if (wasPlaying) {
      this.pauseTimeline();
    }

    this.playbackState.currentEventIndex = eventIndex;
    
    // Calcular tempo decorrido
    if (eventIndex >= 0 && this.events[eventIndex]) {
      this.playbackState.elapsedTime = this.events[eventIndex].timestamp - this.startTime;
    }

    this.updateTimelineDisplay();
    this.highlightCurrentEvent();

    // Trigger callback se configurado
    if (this.onEventPlayback && eventIndex >= 0) {
      this.onEventPlayback(this.events[eventIndex], eventIndex);
    }

    if (wasPlaying) {
      this.playTimeline();
    }

    console.log(`🎯 Navegado para evento ${eventIndex + 1}/${this.events.length}`);
  }

  /**
   * Iniciar timer de reprodução
   */
  private startPlaybackTimer(): void {
    this.stopPlaybackTimer();

    const baseInterval = 100; // 100ms base
    const actualInterval = baseInterval / this.playbackState.speed;

    this.playbackTimer = window.setInterval(() => {
      this.processNextEvent();
    }, actualInterval);
  }

  /**
   * Parar timer de reprodução
   */
  private stopPlaybackTimer(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  /**
   * Processar próximo evento na reprodução
   */
  private processNextEvent(): void {
    if (!this.playbackState.isPlaying || this.events.length === 0) return;

    const currentTime = Date.now();
    const nextEventIndex = this.playbackState.currentEventIndex + 1;

    // Verificar se chegou ao fim
    if (nextEventIndex >= this.events.length || 
        (this.playbackConfig.endAtEvent !== undefined && nextEventIndex > this.playbackConfig.endAtEvent)) {
      this.stopTimeline();
      return;
    }

    const nextEvent = this.events[nextEventIndex];
    const eventTime = nextEvent.timestamp - this.startTime;
    
    // Verificar se é hora de reproduzir este evento
    const scaledEventTime = eventTime / this.playbackState.speed;
    
    if (this.playbackState.elapsedTime >= scaledEventTime) {
      this.playbackState.currentEventIndex = nextEventIndex;
      this.playbackState.elapsedTime = scaledEventTime;
      
      // Destacar evento atual
      this.highlightCurrentEvent();
      
      // Trigger callback
      if (this.onEventPlayback) {
        this.onEventPlayback(nextEvent, nextEventIndex);
      }

      // Pular screenshots se configurado
      if (this.playbackConfig.skipScreenshots && nextEvent.type === 'screenshot') {
        // Processar próximo evento imediatamente
        setTimeout(() => this.processNextEvent(), 10);
        return;
      }

      console.log(`🎬 Reproduzindo evento ${nextEventIndex + 1}: ${nextEvent.type}`);
    }

    // Atualizar tempo decorrido
    this.playbackState.elapsedTime += (100 / this.playbackState.speed);
    
    // Calcular tempo restante
    const totalDuration = this.events.length > 0 ? 
      (this.events[this.events.length - 1].timestamp - this.startTime) : 0;
    this.playbackState.remainingTime = Math.max(0, totalDuration - this.playbackState.elapsedTime);

    // Atualizar UI
    this.updateTimelineProgress();
  }

  /**
   * Destacar evento atual na timeline
   */
  private highlightCurrentEvent(): void {
    const timelineTrack = document.getElementById('timelineTrack');
    if (!timelineTrack) return;

    // Remover destaque anterior
    const previousActive = timelineTrack.querySelector('.timeline-item.active');
    if (previousActive) {
      previousActive.classList.remove('active');
    }

    // Destacar evento atual
    if (this.playbackState.currentEventIndex >= 0) {
      const currentItem = timelineTrack.children[this.playbackState.currentEventIndex] as HTMLElement;
      if (currentItem) {
        currentItem.classList.add('active');
        
        // Scroll para o evento se necessário
        currentItem.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }

  /**
   * Atualizar controles de reprodução
   */
  private updatePlaybackControls(): void {
    const playBtn = document.getElementById('playTimelineBtn') as HTMLButtonElement;
    const pauseBtn = document.getElementById('pauseTimelineBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopTimelineBtn') as HTMLButtonElement;

    const hasEvents = this.events.length > 0;

    if (playBtn) {
      playBtn.disabled = !hasEvents;
      playBtn.style.display = this.playbackState.isPlaying ? 'none' : 'inline-flex';
      
      const icon = playBtn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', 'play');
      }
    }

    if (pauseBtn) {
      pauseBtn.disabled = !hasEvents;
      pauseBtn.style.display = this.playbackState.isPlaying ? 'inline-flex' : 'none';
    }

    if (stopBtn) {
      stopBtn.disabled = !hasEvents || (!this.playbackState.isPlaying && this.playbackState.currentEventIndex === -1);
    }

    // Atualizar informações de reprodução
    this.updatePlaybackInfo();

    // Reinicializar ícones Lucide
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  }

  /**
   * Atualizar informações de reprodução
   */
  private updatePlaybackInfo(): void {
    const currentEventElement = document.getElementById('currentEventIndex');
    const totalEventsElement = document.getElementById('totalEvents');
    const elapsedTimeElement = document.getElementById('elapsedTime');
    const remainingTimeElement = document.getElementById('remainingTime');

    if (currentEventElement) {
      currentEventElement.textContent = `${Math.max(0, this.playbackState.currentEventIndex + 1)}`;
    }

    if (totalEventsElement) {
      totalEventsElement.textContent = `${this.playbackState.totalEvents}`;
    }

    if (elapsedTimeElement) {
      elapsedTimeElement.textContent = formatDuration(this.playbackState.elapsedTime);
    }

    if (remainingTimeElement) {
      remainingTimeElement.textContent = formatDuration(this.playbackState.remainingTime);
    }
  }

  /**
   * Atualizar display da velocidade
   */
  private updateSpeedDisplay(): void {
    const speedSelect = document.getElementById('timelineSpeed') as HTMLSelectElement;
    if (speedSelect) {
      speedSelect.value = this.playbackState.speed.toString();
    }
  }

  /**
   * Atualizar progresso da timeline
   */
  private updateTimelineProgress(): void {
    const progressSlider = document.getElementById('timelineProgress') as HTMLInputElement;
    if (progressSlider && this.events.length > 0) {
      const progress = (this.playbackState.currentEventIndex + 1) / this.events.length * 100;
      progressSlider.value = progress.toString();
    }
  }

  /**
   * Atualizar display da timeline
   */
  private updateTimelineDisplay(): void {
    const timelineTrack = document.getElementById('timelineTrack');
    if (!timelineTrack) return;

    if (this.timelineItems.length === 0) {
      this.showEmptyTimeline();
      return;
    }

    // Limpar timeline
    timelineTrack.innerHTML = '';

    // Renderizar items visíveis
    this.timelineItems.forEach((item, index) => {
      if (!item.isVisible) return;

      const timelineElement = this.createTimelineElement(item, index);
      timelineTrack.appendChild(timelineElement);
    });

    // Reinicializar ícones Lucide
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  }

  /**
   * Criar elemento da timeline
   */
  private createTimelineElement(item: TimelineItem, index: number): HTMLElement {
    const element = document.createElement('div');
    element.className = `timeline-item ${item.cssClass}`;
    element.setAttribute('data-event-index', index.toString());
    
    // Posicionar baseado no tempo relativo
    const maxDuration = this.events.length > 0 ? 
      (this.events[this.events.length - 1].timestamp - this.startTime) : 1;
    const position = (item.relativeTime / maxDuration) * 100;
    element.style.left = `${Math.min(95, Math.max(2, position))}%`;

    element.innerHTML = `
      <div class="timeline-marker">
        <i data-lucide="${getEventIcon(item.event.type)}" class="timeline-icon"></i>
      </div>
      <div class="timeline-tooltip">
        <div class="tooltip-type">${item.event.type}</div>
        <div class="tooltip-time">${item.displayTime}</div>
        ${item.event.selector ? `<div class="tooltip-selector">${item.event.selector}</div>` : ''}
        ${item.event.value ? `<div class="tooltip-value">${item.event.value.substring(0, 50)}${item.event.value.length > 50 ? '...' : ''}</div>` : ''}
      </div>
    `;

    // Adicionar click listener
    element.addEventListener('click', () => {
      this.seekToEvent(index);
    });

    return element;
  }

  /**
   * Mostrar timeline vazia
   */
  private showEmptyTimeline(): void {
    const timelineTrack = document.getElementById('timelineTrack');
    if (!timelineTrack) return;

    timelineTrack.innerHTML = `
      <div class="timeline-empty">
        <i data-lucide="activity" class="empty-icon"></i>
        <p>Timeline vazia</p>
        <small>A timeline será preenchida conforme as ações são gravadas</small>
      </div>
    `;

    // Reinicializar ícones
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  }

  /**
   * Atualizar filtros de eventos
   */
  private updateEventFilters(): void {
    const filterCheckboxes = document.querySelectorAll('input[data-timeline-filter]') as NodeListOf<HTMLInputElement>;
    const newShowEventTypes = new Set<RecordingEventType>();

    filterCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        newShowEventTypes.add(checkbox.getAttribute('data-timeline-filter') as RecordingEventType);
      }
    });

    this.config.showEventTypes = newShowEventTypes;
    this.regenerateTimelineItems();
    this.updateTimelineDisplay();

    console.log(`🔍 Filtros atualizados: ${newShowEventTypes.size} tipos visíveis`);
  }

  /**
   * Definir callback de reprodução de eventos
   */
  public setEventPlaybackCallback(callback: (event: RecordingEvent, index: number) => void): void {
    this.onEventPlayback = callback;
  }

  /**
   * Obter estado atual da reprodução
   */
  public getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Obter configuração atual
   */
  public getConfig(): TimelineConfig {
    return { ...this.config };
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopTimeline();
    this.events = [];
    this.timelineItems = [];
    
    console.log('🧹 TimelineManager destruído');
  }
}
