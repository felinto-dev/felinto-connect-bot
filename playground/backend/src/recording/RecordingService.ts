import type { Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import {
  BroadcastFn,
  RecordingConfig,
  RecordingData,
  RecordingEvent,
  RecordingEventType,
  RecordingStatus
} from '../types.js';

export class RecordingService {
  private page: Page;
  private config: RecordingConfig;
  private recording: RecordingData;
  private broadcastFn: BroadcastFn;
  private isCapturing: boolean = false;
  private screenshotInterval?: NodeJS.Timeout;
  private eventListeners: Map<string, (...args: any[]) => void> = new Map();
  
  // Controle de debounce para navegação
  private navigationTimeout?: NodeJS.Timeout;
  private lastNavigationUrl: string = '';
  private lastNavigationTime: number = 0;

  constructor(
    page: Page,
    recording: RecordingData,
    broadcastFn: BroadcastFn
  ) {
    this.page = page;
    this.config = recording.config;
    this.recording = recording;
    this.broadcastFn = broadcastFn;
  }

  /**
   * Iniciar captura de eventos
   */
  async startCapture(): Promise<void> {
    if (this.isCapturing) {
      throw new Error('Captura já está ativa');
    }

    console.log(`🎬 Iniciando captura de eventos para gravação: ${this.recording.id}`);
    
    this.isCapturing = true;
    
    try {
      // Configurar captura de eventos baseado na configuração
      await this.setupEventListeners();
      
      // Capturar screenshot inicial se configurado
      if (this.config.captureScreenshots) {
        await this.captureScreenshot('initial');
      }

      // Registrar evento de início
      await this.addEvent({
        type: 'page_load',
        metadata: {
          url: await this.page.url(),
          title: await this.page.title(),
          timestamp: Date.now()
        }
      });

      this.broadcastFn({
        type: 'recording_status',
        message: `🎬 Captura iniciada para gravação: ${this.recording.id}`,
        sessionId: this.recording.sessionId,
        recordingId: this.recording.id,
        data: { status: 'recording', eventCount: this.recording.events.length }
      });

    } catch (error: any) {
      this.isCapturing = false;
      console.error('Erro ao iniciar captura:', error);
      throw error;
    }
  }

  /**
   * Parar captura de eventos
   */
  async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      return;
    }

    console.log(`🛑 Parando captura de eventos para gravação: ${this.recording.id}`);
    
    // Primeiro parar screenshots automáticos para prevenir novas capturas
    this.stopAutomaticScreenshots();

    // Limpar timeout de navegação
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
      this.navigationTimeout = undefined;
    }

    // Capturar screenshot final ANTES de definir isCapturing = false
    if (this.config.captureScreenshots) {
      try {
        await this.captureScreenshot('final');
      } catch (error) {
        console.warn('⚠️ Erro ao capturar screenshot final:', error);
      }
    }

    // Agora sim definir isCapturing = false e remover listeners
    this.isCapturing = false;

    // Remover todos os event listeners
    await this.removeEventListeners();

    this.broadcastFn({
      type: 'recording_status',
      message: `🛑 Captura finalizada para gravação: ${this.recording.id}`,
      sessionId: this.recording.sessionId,
      recordingId: this.recording.id,
      data: { status: 'stopped', eventCount: this.recording.events.length }
    });
  }

  /**
   * Pausar captura de eventos
   */
  pauseCapture(): void {
    if (!this.isCapturing) {
      return;
    }

    console.log(`⏸️ Pausando captura para gravação: ${this.recording.id}`);
    
    // Parar screenshots automáticos temporariamente
    this.stopAutomaticScreenshots();

    // Limpar timeout de navegação pendente
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
      this.navigationTimeout = undefined;
    }

    this.recording.status = 'paused';
  }

  /**
   * Resumir captura de eventos
   */
  resumeCapture(): void {
    if (!this.isCapturing) {
      return;
    }

    console.log(`▶️ Resumindo captura para gravação: ${this.recording.id}`);
    
    this.recording.status = 'recording';
  }

  /**
   * Configurar event listeners baseado na configuração
   */
  private async setupEventListeners(): Promise<void> {
    const events = this.config.events;

    // Click events
    if (events.includes('click')) {
      await this.setupClickListener();
    }

    // Type events
    if (events.includes('type')) {
      await this.setupTypeListener();
    }

    // Navigation events
    if (events.includes('navigation')) {
      await this.setupNavigationListener();
    }

    // Scroll events
    if (events.includes('scroll')) {
      await this.setupScrollListener();
    }

    // Hover events
    if (events.includes('hover')) {
      await this.setupHoverListener();
    }

    // Key press events
    if (events.includes('key_press')) {
      await this.setupKeyPressListener();
    }

    // Form submit events
    if (events.includes('form_submit')) {
      await this.setupFormSubmitListener();
    }
  }

  /**
   * Configurar listener para clicks
   */
  private async setupClickListener(): Promise<void> {
    const clickHandler = async (event: any) => {
      if (!this.shouldCaptureEvent()) return;

      // Capturar evento de click
      await this.addEvent({
        type: 'click',
        coordinates: { x: event.clientX, y: event.clientY },
        selector: await this.getElementSelector(event.target),
        metadata: {
          button: event.button,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey
        }
      });

      // Capturar screenshot após click se configurado
      if (this.config.captureScreenshots) {
        try {
          await this.captureScreenshot('click');
        } catch (error) {
          console.warn('⚠️ Erro ao capturar screenshot após click:', error);
        }
      }
    };

    await this.page.evaluateOnNewDocument(() => {
      document.addEventListener('click', (event) => {
        (window as any).__recordingClickHandler?.(event);
      }, true);
    });

    await this.page.exposeFunction('__recordingClickHandler', clickHandler);
    this.eventListeners.set('click', clickHandler);
  }

  /**
   * Configurar listener para digitação
   */
  private async setupTypeListener(): Promise<void> {
    const inputHandler = async (event: any) => {
      if (!this.shouldCaptureEvent()) return;

      const value = this.maskSensitiveValue(event.target.value, event.target.type);
      
      await this.addEvent({
        type: 'type',
        selector: await this.getElementSelector(event.target),
        value: value,
        metadata: {
          inputType: event.target.type,
          tagName: event.target.tagName.toLowerCase()
        }
      });
    };

    await this.page.evaluateOnNewDocument(() => {
      document.addEventListener('input', (event) => {
        (window as any).__recordingInputHandler?.(event);
      }, true);
    });

    await this.page.exposeFunction('__recordingInputHandler', inputHandler);
    this.eventListeners.set('input', inputHandler);
  }

  /**
   * Configurar listener para navegação
   */
  private async setupNavigationListener(): Promise<void> {
    const navigationHandler = async (frame: any) => {
      try {
        if (!this.shouldCaptureEvent()) return;
        
        // Verificar se é o frame principal usando a propriedade _frameManager
        // ou comparando com o mainFrame da página
        const isMainFrame = frame === this.page.mainFrame();
        if (!isMainFrame) {
          return;
        }

        const currentUrl = await this.page.url();
        const currentTime = Date.now();
        
        // Verificar se é uma navegação duplicada (mesma URL em menos de 1 segundo)
        if (this.lastNavigationUrl === currentUrl && 
            (currentTime - this.lastNavigationTime) < 1000) {
          console.log(`🔄 Navegação duplicada ignorada: ${currentUrl}`);
          return;
        }

        // Limpar timeout anterior se existir
        if (this.navigationTimeout) {
          clearTimeout(this.navigationTimeout);
        }

        // Implementar debounce de 300ms para navegação
        this.navigationTimeout = setTimeout(async () => {
          try {
            // Verificar novamente se deve capturar (pode ter mudado durante o timeout)
            if (!this.shouldCaptureEvent()) return;

            const finalUrl = await this.page.url();
            const finalTime = Date.now();

            // Verificação final de duplicação
            if (this.lastNavigationUrl === finalUrl && 
                (finalTime - this.lastNavigationTime) < 1000) {
              return;
            }

            // Atualizar controle de duplicação
            this.lastNavigationUrl = finalUrl;
            this.lastNavigationTime = finalTime;

            await this.addEvent({
              type: 'navigation',
              url: finalUrl,
              metadata: {
                title: await this.page.title(),
                timestamp: finalTime
              }
            });

            // Capturar screenshot após navegação se configurado
            if (this.config.captureScreenshots) {
              try {
                await this.captureScreenshot('navigation');
              } catch (error) {
                console.warn('⚠️ Erro ao capturar screenshot após navegação:', error);
              }
            }

            console.log(`🧭 Navegação capturada: ${finalUrl}`);

          } catch (error) {
            console.error('Erro ao capturar evento de navegação (timeout):', error);
          }
        }, 300);

      } catch (error) {
        console.error('Erro no navigationHandler:', error);
      }
    };

    this.page.on('framenavigated', navigationHandler);
    this.eventListeners.set('navigation', navigationHandler);
  }

  /**
   * Configurar listener para scroll
   */
  private async setupScrollListener(): Promise<void> {
    const scrollHandler = async (scrollData: any) => {
      if (!this.shouldCaptureEvent()) return;

      await this.addEvent({
        type: 'scroll',
        coordinates: { x: scrollData.scrollX, y: scrollData.scrollY },
        metadata: {
          scrollTop: scrollData.scrollY,
          scrollLeft: scrollData.scrollX
        }
      });
    };

    await this.page.evaluateOnNewDocument(() => {
      let scrollTimeout: NodeJS.Timeout;
      document.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          (window as any).__recordingScrollHandler?.({
            scrollX: window.scrollX,
            scrollY: window.scrollY
          });
        }, 100); // Debounce scroll events
      }, true);
    });

    await this.page.exposeFunction('__recordingScrollHandler', scrollHandler);
    this.eventListeners.set('scroll', scrollHandler);
  }

  /**
   * Configurar listener para hover
   * NOTA: Eventos de hover NÃO capturam screenshots automaticamente
   * Apenas registram o movimento do mouse sobre elementos
   */
  private async setupHoverListener(): Promise<void> {
    const hoverHandler = async (event: any) => {
      if (!this.shouldCaptureEvent()) return;

      await this.addEvent({
        type: 'hover',
        coordinates: { x: event.clientX, y: event.clientY },
        selector: await this.getElementSelector(event.target),
        metadata: {
          eventType: event.type
        }
      });
    };

    await this.page.evaluateOnNewDocument(() => {
      let hoverTimeout: NodeJS.Timeout;
      document.addEventListener('mouseover', (event) => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          (window as any).__recordingHoverHandler?.(event);
        }, 200); // Debounce hover events
      }, true);
    });

    await this.page.exposeFunction('__recordingHoverHandler', hoverHandler);
    this.eventListeners.set('hover', hoverHandler);
  }

  /**
   * Configurar listener para teclas especiais
   */
  private async setupKeyPressListener(): Promise<void> {
    const keyHandler = async (event: any) => {
      if (!this.shouldCaptureEvent()) return;

      // Capturar apenas teclas especiais
      const specialKeys = ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      
      if (specialKeys.includes(event.key)) {
        await this.addEvent({
          type: 'key_press',
          value: event.key,
          metadata: {
            code: event.code,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey
          }
        });
      }
    };

    await this.page.evaluateOnNewDocument(() => {
      document.addEventListener('keydown', (event) => {
        (window as any).__recordingKeyHandler?.(event);
      }, true);
    });

    await this.page.exposeFunction('__recordingKeyHandler', keyHandler);
    this.eventListeners.set('keydown', keyHandler);
  }

  /**
   * Configurar listener para envio de formulários
   */
  private async setupFormSubmitListener(): Promise<void> {
    const submitHandler = async (event: any) => {
      if (!this.shouldCaptureEvent()) return;

      await this.addEvent({
        type: 'form_submit',
        selector: await this.getElementSelector(event.target),
        metadata: {
          action: event.target.action,
          method: event.target.method
        }
      });
    };

    await this.page.evaluateOnNewDocument(() => {
      document.addEventListener('submit', (event) => {
        (window as any).__recordingSubmitHandler?.(event);
      }, true);
    });

    await this.page.exposeFunction('__recordingSubmitHandler', submitHandler);
    this.eventListeners.set('submit', submitHandler);
  }

  /**
   * Remover todos os event listeners
   */
  private async removeEventListeners(): Promise<void> {
    // Remover listeners do Puppeteer
    this.page.removeAllListeners('framenavigated');

    // Limpar funções expostas
    for (const [eventType] of this.eventListeners) {
      try {
        await this.page.evaluate((eventType) => {
          delete (window as any)[`__recording${eventType.charAt(0).toUpperCase() + eventType.slice(1)}Handler`];
        }, eventType);
      } catch (error) {
        // Ignorar erros de limpeza
      }
    }

    this.eventListeners.clear();
  }

  /**
   * Verificar se deve capturar evento baseado no status
   */
  private shouldCaptureEvent(): boolean {
    return this.isCapturing && this.recording.status === 'recording';
  }

  /**
   * Adicionar evento à gravação
   */
  private async addEvent(eventData: Partial<RecordingEvent>): Promise<void> {
    const event: RecordingEvent = {
      id: uuidv4(),
      type: eventData.type!,
      timestamp: Date.now(),
      selector: eventData.selector,
      value: eventData.value,
      coordinates: eventData.coordinates,
      url: eventData.url || await this.page.url(),
      metadata: eventData.metadata,
      duration: eventData.duration
    };

    // Verificar limites
    if (this.config.maxEvents && this.recording.events.length >= this.config.maxEvents) {
      console.warn(`Limite de eventos atingido: ${this.config.maxEvents}`);
      return;
    }

    // Adicionar delay se configurado
    if (this.config.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.delay));
    }

    // Adicionar evento à gravação
    this.recording.events.push(event);
    this.recording.metadata.totalEvents = this.recording.events.length;

    // Broadcast evento em tempo real
    this.broadcastFn({
      type: 'recording_event',
      message: `Evento capturado: ${event.type}`,
      sessionId: this.recording.sessionId,
      recordingId: this.recording.id,
      data: event
    });

    console.log(`📝 Evento capturado: ${event.type} - Total: ${this.recording.events.length}`);
  }

  /**
   * Capturar screenshot
   */
  private async captureScreenshot(type: string = 'auto'): Promise<void> {
    try {
      const screenshot = await this.page.screenshot({
        type: 'jpeg',
        encoding: 'base64',
        fullPage: false,
        quality: 80
      });

      await this.addEvent({
        type: 'screenshot',
        screenshot: `data:image/jpeg;base64,${screenshot}`,
        metadata: {
          screenshotType: type,
          timestamp: Date.now()
        }
      });

      this.recording.metadata.totalScreenshots++;

    } catch (error) {
      console.error('Erro ao capturar screenshot:', error);
    }
  }

  /**
   * Iniciar screenshots automáticos
   */
  /**
   * Parar screenshots automáticos
   */
  private stopAutomaticScreenshots(): void {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = undefined;
      console.log('📸 Screenshots automáticos parados');
    }
  }

  /**
   * Iniciar screenshots automáticos
   */
  private startAutomaticScreenshots(): void {
    if (this.screenshotInterval || !this.config.screenshotInterval) {
      return;
    }

    this.screenshotInterval = setInterval(async () => {
      if (this.shouldCaptureEvent()) {
        await this.captureScreenshot('automatic');
      }
    }, this.config.screenshotInterval);
    console.log(`📸 Screenshots automáticos iniciados (${this.config.screenshotInterval}ms)`);
  }

  /**
   * Gerar seletor único para elemento
   */
  private async getElementSelector(element: any): Promise<string> {
    try {
      return await this.page.evaluate((el) => {
        if (!el) return '';
        
        // Tentar ID primeiro
        if (el.id) {
          return `#${el.id}`;
        }
        
        // Tentar combinação de tag + classes
        const tagName = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).slice(0, 2).join('.');
        
        if (classes) {
          return `${tagName}.${classes}`;
        }
        
        // Fallback para tag + nth-child
        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((child: any) => child.tagName === el.tagName);
          if (siblings.length > 1) {
            const index = siblings.indexOf(el) + 1;
            return `${tagName}:nth-of-type(${index})`;
          }
        }
        
        return tagName;
      }, element);
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Mascarar valores sensíveis
   */
  private maskSensitiveValue(value: string, inputType?: string): string {
    if (!value) return value;

    // Campos de senha
    if (inputType === 'password') {
      return '*'.repeat(value.length);
    }

    // Emails (mostrar apenas domínio)
    if (inputType === 'email' && value.includes('@')) {
      const [, domain] = value.split('@');
      return `***@${domain}`;
    }

    // Números longos (possíveis cartões)
    if (/^\d{13,19}$/.test(value.replace(/\s/g, ''))) {
      return `**** **** **** ${value.slice(-4)}`;
    }

    return value;
  }

  /**
   * Obter dados da gravação atual
   */
  getRecordingData(): RecordingData {
    return this.recording;
  }

  /**
   * Verificar se está capturando
   */
  isActive(): boolean {
    return this.isCapturing;
  }
}
