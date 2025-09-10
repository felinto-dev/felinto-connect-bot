import type { Page } from 'puppeteer';
import {
  BroadcastFn,
  RecordingData,
  RecordingEvent,
  PlaybackConfig,
  PlaybackStatus
} from '../types.js';

export class PlaybackService {
  private page: Page;
  private recording: RecordingData;
  private config: PlaybackConfig;
  private broadcastFn: BroadcastFn;
  private status: PlaybackStatus;
  private playbackTimer: NodeJS.Timeout | null = null;
  private isPlaying: boolean = false;
  private startTime: number = 0;

  constructor(
    page: Page,
    recording: RecordingData,
    config: PlaybackConfig,
    broadcastFn: BroadcastFn
  ) {
    this.page = page;
    this.recording = recording;
    this.config = config;
    this.broadcastFn = broadcastFn;
    
    this.status = {
      isPlaying: false,
      currentEventIndex: config.startFromEvent || 0,
      totalEvents: recording.events.length,
      elapsedTime: 0,
      remainingTime: 0,
      speed: config.speed
    };
  }

  /**
   * Iniciar reprodução
   */
  async startPlayback(): Promise<void> {
    if (this.isPlaying) {
      throw new Error('Reprodução já está em andamento');
    }

    console.log(`▶️ Iniciando reprodução da gravação: ${this.recording.id}`);
    
    this.isPlaying = true;
    this.status.isPlaying = true;
    this.startTime = Date.now();

    try {
      // Navegar para URL inicial se disponível
      if (this.recording.metadata.initialUrl) {
        await this.page.goto(this.recording.metadata.initialUrl, { 
          waitUntil: 'domcontentloaded' 
        });
      }

      // Configurar viewport se disponível
      if (this.recording.metadata.viewport) {
        await this.page.setViewport(this.recording.metadata.viewport);
      }

      // Broadcast início
      this.broadcastFn({
        type: 'info',
        message: `▶️ Reprodução iniciada: ${this.recording.events.length} eventos`,
        sessionId: this.recording.sessionId,
        data: { playbackStatus: this.status }
      });

      // Iniciar processamento de eventos
      this.startEventProcessing();

    } catch (error: any) {
      this.isPlaying = false;
      this.status.isPlaying = false;
      console.error('❌ Erro ao iniciar reprodução:', error);
      throw error;
    }
  }

  /**
   * Pausar reprodução
   */
  pausePlayback(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.status.isPlaying = false;
    
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.broadcastFn({
      type: 'info',
      message: '⏸️ Reprodução pausada',
      sessionId: this.recording.sessionId,
      data: { playbackStatus: this.status }
    });

    console.log('⏸️ Reprodução pausada');
  }

  /**
   * Resumir reprodução
   */
  resumePlayback(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.status.isPlaying = true;
    
    this.startEventProcessing();

    this.broadcastFn({
      type: 'info',
      message: '▶️ Reprodução resumida',
      sessionId: this.recording.sessionId,
      data: { playbackStatus: this.status }
    });

    console.log('▶️ Reprodução resumida');
  }

  /**
   * Parar reprodução
   */
  stopPlayback(): void {
    this.isPlaying = false;
    this.status.isPlaying = false;
    this.status.currentEventIndex = this.config.startFromEvent || 0;
    this.status.elapsedTime = 0;
    
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.broadcastFn({
      type: 'success',
      message: '⏹️ Reprodução finalizada',
      sessionId: this.recording.sessionId,
      data: { playbackStatus: this.status }
    });

    console.log('⏹️ Reprodução parada');
  }

  /**
   * Navegar para evento específico
   */
  async seekToEvent(eventIndex: number): Promise<void> {
    if (eventIndex < 0 || eventIndex >= this.recording.events.length) {
      throw new Error(`Índice de evento inválido: ${eventIndex}`);
    }

    const wasPlaying = this.isPlaying;
    
    if (wasPlaying) {
      this.pausePlayback();
    }

    this.status.currentEventIndex = eventIndex;
    
    // Calcular tempo decorrido até este evento
    const targetEvent = this.recording.events[eventIndex];
    this.status.elapsedTime = targetEvent.timestamp - this.recording.startTime;

    console.log(`🎯 Navegado para evento ${eventIndex + 1}/${this.recording.events.length}`);

    if (wasPlaying) {
      this.resumePlayback();
    }
  }

  /**
   * Iniciar processamento de eventos
   */
  private startEventProcessing(): void {
    if (!this.isPlaying || this.status.currentEventIndex >= this.recording.events.length) {
      this.stopPlayback();
      return;
    }

    const currentEvent = this.recording.events[this.status.currentEventIndex];
    const nextEvent = this.recording.events[this.status.currentEventIndex + 1];

    // Executar evento atual
    this.executeEvent(currentEvent)
      .then(() => {
        if (!this.isPlaying) return;

        // Calcular delay para próximo evento
        let delay = 100; // Delay mínimo
        
        if (nextEvent) {
          const eventDelay = (nextEvent.timestamp - currentEvent.timestamp) / this.config.speed;
          delay = Math.max(100, Math.min(eventDelay, 5000)); // Entre 100ms e 5s
        }

        // Atualizar status
        this.status.currentEventIndex++;
        this.status.elapsedTime = Date.now() - this.startTime;
        
        // Calcular tempo restante
        const totalDuration = this.recording.duration || 0;
        this.status.remainingTime = Math.max(0, totalDuration - this.status.elapsedTime);

        // Broadcast progresso
        if (this.status.currentEventIndex % 5 === 0) { // A cada 5 eventos
          this.broadcastFn({
            type: 'info',
            message: `🎬 Reproduzindo evento ${this.status.currentEventIndex}/${this.status.totalEvents}`,
            sessionId: this.recording.sessionId,
            data: { playbackStatus: this.status }
          });
        }

        // Agendar próximo evento
        this.playbackTimer = setTimeout(() => {
          this.startEventProcessing();
        }, delay);

      })
      .catch((error) => {
        console.error(`❌ Erro ao executar evento ${this.status.currentEventIndex}:`, error);
        
        if (this.config.pauseOnError) {
          this.pausePlayback();
          this.broadcastFn({
            type: 'error',
            message: `❌ Erro na reprodução: ${error.message}`,
            sessionId: this.recording.sessionId,
            data: { error: error.message, eventIndex: this.status.currentEventIndex }
          });
        } else {
          // Continuar com próximo evento
          this.status.currentEventIndex++;
          this.startEventProcessing();
        }
      });
  }

  /**
   * Executar evento específico
   */
  private async executeEvent(event: RecordingEvent): Promise<void> {
    console.log(`🎬 Executando evento: ${event.type} (${this.status.currentEventIndex + 1}/${this.status.totalEvents})`);

    try {
      switch (event.type) {
        case 'click':
          await this.executeClickEvent(event);
          break;
        
        case 'type':
          await this.executeTypeEvent(event);
          break;
        
        case 'navigation':
          await this.executeNavigationEvent(event);
          break;
        
        
        case 'key_press':
          await this.executeKeyPressEvent(event);
          break;
        
        case 'form_submit':
          await this.executeFormSubmitEvent(event);
          break;
        
        case 'screenshot':
          await this.executeScreenshotEvent(event);
          break;
        
        case 'page_load':
          await this.executePageLoadEvent(event);
          break;
        
        default:
          console.warn(`⚠️ Tipo de evento não suportado: ${event.type}`);
      }

      // Delay configurado entre eventos
      if (this.recording.config.delay > 0) {
        await this.wait(this.recording.config.delay / this.config.speed);
      }

    } catch (error) {
      console.error(`❌ Erro ao executar evento ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Executar evento de click
   */
  private async executeClickEvent(event: RecordingEvent): Promise<void> {
    if (event.selector) {
      await this.page.click(event.selector);
    } else if (event.coordinates) {
      await this.page.mouse.click(event.coordinates.x, event.coordinates.y);
    }
  }

  /**
   * Executar evento de digitação
   */
  private async executeTypeEvent(event: RecordingEvent): Promise<void> {
    if (event.selector && event.value) {
      // Limpar campo primeiro
      await this.page.click(event.selector);
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('KeyA');
      await this.page.keyboard.up('Control');
      
      // Digitar novo valor
      await this.page.type(event.selector, event.value);
    }
  }

  /**
   * Executar evento de navegação
   */
  private async executeNavigationEvent(event: RecordingEvent): Promise<void> {
    if (event.url) {
      await this.page.goto(event.url, { 
        waitUntil: 'domcontentloaded' 
      });
    }
  }




  /**
   * Executar evento de tecla
   */
  private async executeKeyPressEvent(event: RecordingEvent): Promise<void> {
    if (event.value) {
      // Mapear teclas para formato Puppeteer
      const keyMap: Record<string, string> = {
        'Enter': 'Enter',
        'Tab': 'Tab',
        'Escape': 'Escape',
        'Backspace': 'Backspace',
        'Delete': 'Delete',
        'ArrowUp': 'ArrowUp',
        'ArrowDown': 'ArrowDown',
        'ArrowLeft': 'ArrowLeft',
        'ArrowRight': 'ArrowRight'
      };
      
      const puppeteerKey = keyMap[event.value] || event.value;
      await this.page.keyboard.press(puppeteerKey as any);
    }
  }

  /**
   * Executar evento de envio de formulário
   */
  private async executeFormSubmitEvent(event: RecordingEvent): Promise<void> {
    if (event.selector) {
      await this.page.evaluate((selector) => {
        const form = document.querySelector(selector) as HTMLFormElement;
        if (form) {
          form.submit();
        }
      }, event.selector);
    }
  }

  /**
   * Executar evento de screenshot
   */
  private async executeScreenshotEvent(event: RecordingEvent): Promise<void> {
    if (!this.config.skipScreenshots) {
      const screenshot = await this.page.screenshot({
        encoding: 'base64',
        fullPage: false,
        quality: 80
      });
      
      console.log(`📸 Screenshot capturado durante reprodução`);
    }
  }

  /**
   * Executar evento de carregamento de página
   */
  private async executePageLoadEvent(event: RecordingEvent): Promise<void> {
    await this.page.waitForSelector('body', { timeout: 5000 });
  }

  /**
   * Utilitário para espera
   */
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obter status atual
   */
  getStatus(): PlaybackStatus {
    return { ...this.status };
  }

  /**
   * Verificar se está reproduzindo
   */
  isActive(): boolean {
    return this.isPlaying;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopPlayback();
    console.log(`🧹 PlaybackService destruído para gravação: ${this.recording.id}`);
  }
}
