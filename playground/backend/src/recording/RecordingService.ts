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

  // Armazenar estados dos inputs para evitar duplicação e debounce inteligente
  private inputStates: Map<string, { 
    value: string, 
    lastChange: number, 
    lastCapture: number,
    capturedByKeyboard: boolean 
  }> = new Map();

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
    console.log(`✅ Estado após iniciar: isCapturing=${this.isCapturing}, status=${this.recording.status}`);
    
    try {
      // Configurar captura de eventos baseado na configuração
      await this.setupEventListeners();
      
      // Capturar screenshot inicial se configurado
      if (this.config.captureScreenshots) {
        await this.captureScreenshot('initial');
      }

      // Registrar evento de início
      console.log(`🌐 Adicionando evento page_load...`);
      await this.addEvent({
        type: 'page_load',
        metadata: {
          url: await this.page.url(),
          title: await this.page.title(),
          timestamp: Date.now()
        }
      });
      console.log(`✅ Evento page_load adicionado com sucesso`);

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
    console.log('🖱️ Configurando listener de clicks...');

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

    // CORREÇÃO: Expor função ANTES de injetar código JavaScript
    try {
      await this.page.exposeFunction('__recordingClickHandler', clickHandler);
      console.log('✅ Função de click exposta com sucesso');
    } catch (error) {
      console.error('❌ Erro ao expor função de click:', error);
      throw error;
    }

    await this.page.evaluateOnNewDocument(() => {
      document.addEventListener('click', (event) => {
        if ((window as any).__recordingClickHandler) {
          (window as any).__recordingClickHandler(event);
        }
      }, true);
    });

    console.log('✅ Configuração de listener de click concluída');
    this.eventListeners.set('click', clickHandler);
  }

  /**
   * Configurar interceptação de eventos via Puppeteer API (Opção 1)
   */
  private async setupTypeListener(): Promise<void> {
    console.log('🎯 Configurando interceptação de eventos via Puppeteer...');

    // Habilitar interceptação de eventos via CDP
    const client = await this.page.target().createCDPSession();
    
    try {
      // Habilitar domínio Runtime para interceptar eventos
      await client.send('Runtime.enable');
      await client.send('DOM.enable');
      
      console.log('✅ CDP habilitado para interceptação');
    } catch (error) {
      console.error('❌ Erro ao habilitar CDP:', error);
    }

    // Configurar interceptação de mudanças nos inputs via polling inteligente
    await this.setupInputPolling();
    
    // Configurar interceptação de eventos de teclado via Puppeteer
    await this.setupKeyboardInterception();
    
    // Configurar interceptação de eventos de foco/blur
    await this.setupFocusInterception();

    console.log('✅ Interceptação de eventos configurada');
  }

  /**
   * Configurar polling inteligente para detectar mudanças em inputs
   * Otimizado para trabalhar em conjunto com interceptação de TAB/Enter
   */
  private async setupInputPolling(): Promise<void> {
    console.log('📊 Configurando polling de inputs otimizado...');

    // Limpar estados ao iniciar para garantir consistência
    this.inputStates.clear();

    // Função de polling que roda com menor frequência
    const pollInputs = async () => {
      if (!this.shouldCaptureEvent()) return;

      try {
        const currentInputs = await this.page.evaluate(() => {
          const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
          const results: Array<{
            selector: string, 
            value: string, 
            type: string, 
            tagName: string,
            isFocused: boolean,
            valueLength: number
          }> = [];
          
          inputs.forEach((input, index) => {
            const element = input as HTMLInputElement;
            let selector = '';
            
            // Gerar seletor único
            if (element.id) {
              selector = `#${element.id}`;
            } else if (element.name) {
              selector = `[name="${element.name}"]`;
            } else {
              selector = `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
            }
            
            const value = element.value || element.textContent || '';
            
            results.push({
              selector,
              value,
              type: element.type || 'text',
              tagName: element.tagName.toLowerCase(),
              isFocused: element === document.activeElement,
              valueLength: value.length
            });
          });
          
          return results;
        });

        // Verificar mudanças
        for (const input of currentInputs) {
          const key = input.selector;
          const currentTime = Date.now();
          const previousState = this.inputStates.get(key);
          
          if (!previousState) {
            // Primeiro registro
            this.inputStates.set(key, { 
              value: input.value, 
              lastChange: currentTime,
              lastCapture: 0,
              capturedByKeyboard: false
            });
          } else if (previousState.value !== input.value) {
            // Valor mudou
            console.log(`🎯 Mudança detectada em ${key}: "${previousState.value}" -> "${input.value}"`);
            
            // Sistema híbrido: TAB prioritário, polling como backup mínimo
            let debounceTime = 2500; // 2.5 segundos - backup mínimo

            const timeSinceLastChange = currentTime - previousState.lastChange;
            const timeSinceLastCapture = currentTime - previousState.lastCapture;
            
            // Condições de backup de emergência
            const shouldCapture = (
              timeSinceLastChange > debounceTime &&
              !input.isFocused && // Apenas se o campo perdeu o foco
              input.valueLength >= 2 &&
              timeSinceLastCapture > 3500 && // Mais de 3.5s desde a última captura
              !previousState.capturedByKeyboard
            );
            
            if (shouldCapture) {
              console.log(`🆘 Captura de EMERGÊNCIA via polling - ${key}: "${input.value}"`);
            } else if (previousState.capturedByKeyboard && input.valueLength >= 2) {
              console.log(`🚫 Polling bloqueado - ${key}: "${input.value}" já foi capturado via TAB`);
            }
            
            if (shouldCapture) {
              await this.addEvent({
                type: 'type',
                selector: input.selector,
                value: this.maskSensitiveValue(input.value, input.type),
                metadata: {
                  inputType: input.type,
                  tagName: input.tagName,
                  captureReason: 'polling_detection_optimized',
                  previousValue: previousState.value,
                  isFocused: input.isFocused,
                  debounceTime: debounceTime,
                  valueLength: input.valueLength
                }
              });
              
              // Marcar como capturado
              previousState.lastCapture = currentTime;
            }
            
            // Sempre atualizar estado da mudança
            this.inputStates.set(key, { 
              ...previousState,
              value: input.value, 
              lastChange: currentTime,
              capturedByKeyboard: false // Reset flag
            });
          }
        }
      } catch (error) {
        console.error('❌ Erro no polling de inputs:', error);
      }
    };

    // Iniciar polling com frequência muito baixa
    const pollingInterval = setInterval(pollInputs, 2000); // A cada 2 segundos
    
    // Armazenar referência para limpeza
    this.eventListeners.set('input-polling', () => {
      clearInterval(pollingInterval);
      console.log('🛑 Polling de inputs interrompido');
    });

    // Expor função para marcar campos como capturados via teclado
    this.eventListeners.set('mark-keyboard-capture', (selector: string) => {
      const state = this.inputStates.get(selector);
      if (state) {
        state.capturedByKeyboard = true;
        state.lastCapture = Date.now();
        
        // Limpar flag após 3 segundos para permitir futuras capturas
        setTimeout(() => {
          const currentState = this.inputStates.get(selector);
          if (currentState) {
            currentState.capturedByKeyboard = false;
            console.log(`🔓 Flag de captura via TAB limpa para: ${selector}`);
          }
        }, 3000);
      }
    });

    console.log('✅ Polling de inputs otimizado iniciado (500ms, debounce inteligente)');
  }

  /**
   * Configurar interceptação de eventos de teclado
   */
  private async setupKeyboardInterception(): Promise<void> {
    console.log('⌨️ Configurando interceptação de teclado...');

    // Interceptar eventos de teclado via Puppeteer
    this.page.on('console', async (msg) => {
      if (msg.text().startsWith('KEYBOARD_EVENT:')) {
        const eventData = msg.text().replace('KEYBOARD_EVENT:', '');
        try {
          const keyEvent = JSON.parse(eventData);
          
          console.log(`⌨️ Tecla detectada: ${keyEvent.key}`);
          
          if (keyEvent.key === 'Tab' || keyEvent.key === 'Enter') {
            console.log(`🎯 TAB/Enter detectado! Processando campo...`);
            
            // Usar dados do campo atual se disponíveis (capturados ANTES da mudança de foco)
            let fieldData = null;
            
            if (keyEvent.currentField) {
              // Dados já capturados pelo JavaScript injetado
              fieldData = {
                selector: keyEvent.currentField.selector,
                value: keyEvent.currentField.value,
                type: keyEvent.currentField.type,
                tagName: keyEvent.currentField.tagName,
                valueLength: keyEvent.currentField.value.length
              };
              console.log(`📋 Usando dados pré-capturados do campo: ${fieldData.selector}`);
            } else {
              // Fallback: tentar capturar do campo ativo (pode já ter mudado o foco)
              fieldData = await this.page.evaluate(() => {
                const activeElement = document.activeElement as HTMLInputElement;
                if (activeElement && activeElement.matches('input, textarea, [contenteditable]')) {
                  let selector = '';
                  if (activeElement.id) {
                    selector = `#${activeElement.id}`;
                  } else if (activeElement.name) {
                    selector = `[name="${activeElement.name}"]`;
                  } else {
                    const inputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable]'));
                    const index = inputs.indexOf(activeElement);
                    selector = `${activeElement.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
                  }
                  
                  return {
                    selector,
                    value: activeElement.value || activeElement.textContent || '',
                    type: activeElement.type || 'text',
                    tagName: activeElement.tagName.toLowerCase(),
                    valueLength: (activeElement.value || activeElement.textContent || '').length
                  };
                }
                return null;
              });
              console.log(`🔄 Usando fallback para capturar campo ativo`);
            }

            // Capturar se temos dados do campo e tem conteúdo
            if (fieldData && fieldData.valueLength > 0) {
              console.log(`⌨️ ✅ Captura IMEDIATA via ${keyEvent.key}: ${fieldData.selector} = "${fieldData.value}" (${fieldData.valueLength} chars)`);
              
              await this.addEvent({
                type: 'type',
                selector: fieldData.selector,
                value: this.maskSensitiveValue(fieldData.value, fieldData.type),
                metadata: {
                  inputType: fieldData.type,
                  tagName: fieldData.tagName,
                  triggerKey: keyEvent.key,
                  captureReason: 'tab_enter_immediate',
                  valueLength: fieldData.valueLength,
                  priority: 'highest',
                  method: 'keyboard_navigation'
                }
              });

              // Marcar campo como capturado via teclado para evitar duplicação
              const markFunction = this.eventListeners.get('mark-keyboard-capture') as Function;
              if (markFunction) {
                markFunction(fieldData.selector);
                console.log(`🔒 Campo marcado como capturado via TAB: ${fieldData.selector}`);
              }
            } else if (fieldData) {
              console.log(`⌨️ ⏭️ Campo vazio ignorado: ${fieldData.selector} (${fieldData.valueLength} chars)`);
            } else {
              console.log(`⌨️ ❌ Nenhum campo encontrado para ${keyEvent.key}`);
            }

            // Capturar também a tecla pressionada como evento separado (apenas se capturou campo)
            if (fieldData && fieldData.valueLength > 0) {
              await this.addEvent({
                type: 'key_press',
                value: keyEvent.key,
                selector: fieldData.selector, // Associar à campo que foi capturado
                metadata: {
                  code: keyEvent.code,
                  ctrlKey: keyEvent.ctrlKey,
                  shiftKey: keyEvent.shiftKey,
                  altKey: keyEvent.altKey,
                  captureReason: 'navigation_key',
                  associatedField: fieldData.selector,
                  fieldValue: fieldData.value,
                  action: `Pressed ${keyEvent.key} after typing "${fieldData.value}"`
                }
              });
            }
          }
        } catch (error) {
          console.error('❌ Erro ao processar evento de teclado:', error);
        }
      }
    });

    // Injetar interceptador de teclado na página atual E futuras páginas
    const keyboardScript = () => {
      document.addEventListener('keydown', (event) => {
        if (event.target && (event.target as HTMLElement).matches('input, textarea, [contenteditable]')) {
          const element = event.target as HTMLInputElement;
          
          // Para TAB/Enter, capturar dados do campo ATUAL (antes da mudança de foco)
          if (event.key === 'Tab' || event.key === 'Enter') {
            let selector = '';
            if (element.id) {
              selector = `#${element.id}`;
            } else if (element.name) {
              selector = `[name="${element.name}"]`;
            } else {
              const inputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable]'));
              const index = inputs.indexOf(element);
              selector = `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
            }
            
            console.log('KEYBOARD_EVENT:' + JSON.stringify({
              key: event.key,
              code: event.code,
              ctrlKey: event.ctrlKey,
              shiftKey: event.shiftKey,
              altKey: event.altKey,
              // Dados do campo ATUAL (antes da mudança de foco)
              currentField: {
                selector: selector,
                value: element.value || element.textContent || '',
                type: element.type || 'text',
                tagName: element.tagName.toLowerCase()
              }
            }));
          } else {
            // Para outras teclas, apenas registrar
            console.log('KEYBOARD_EVENT:' + JSON.stringify({
              key: event.key,
              code: event.code,
              ctrlKey: event.ctrlKey,
              shiftKey: event.shiftKey,
              altKey: event.altKey
            }));
          }
        }
      }, true);
    };

    // Injetar na página atual (se já carregada)
    await this.page.evaluate(keyboardScript);
    console.log('✅ Script de teclado injetado na página atual');

    // Injetar em futuras páginas
    await this.page.evaluateOnNewDocument(keyboardScript);

    console.log('✅ Interceptação de teclado configurada');
  }

  /**
   * Configurar interceptação de eventos de foco/blur
   */
  private async setupFocusInterception(): Promise<void> {
    console.log('🔄 Configurando interceptação de foco/blur...');

    // Interceptar eventos de foco via console
    this.page.on('console', async (msg) => {
      if (msg.text().startsWith('FOCUS_EVENT:')) {
        const eventData = msg.text().replace('FOCUS_EVENT:', '');
        try {
          const focusEvent = JSON.parse(eventData);
          
          // Verificar se já foi capturado via teclado para evitar duplicatas
          const state = this.inputStates.get(focusEvent.selector);
          console.log(`🔄 Verificando evento de blur para ${focusEvent.selector}. Estado:`, state);

          if (state && state.capturedByKeyboard) {
            console.log(`🔄 ⏭️ Ignorando blur - ${focusEvent.selector}: já foi capturado via TAB/Enter. Flag: ${state.capturedByKeyboard}`);
            return;
          }
          
          if (focusEvent.type === 'blur' && focusEvent.value && focusEvent.valueLength >= 2) {
            console.log(`🔄 ✅ Captura BACKUP via blur: ${focusEvent.selector} = "${focusEvent.value}" (${focusEvent.valueLength} chars)`);
            
            // Capturar valor ao perder foco (backup para casos perdidos por TAB/Enter)
            await this.addEvent({
              type: 'type',
              selector: focusEvent.selector,
              value: this.maskSensitiveValue(focusEvent.value, focusEvent.inputType),
              metadata: {
                inputType: focusEvent.inputType,
                tagName: focusEvent.tagName,
                captureReason: 'blur_backup_safety',
                valueLength: focusEvent.valueLength,
                priority: 'medium',
                method: 'focus_lost_backup'
              }
            });

            // Marcar como capturado para evitar duplicação em polling futuro
            if (state) {
              state.lastCapture = Date.now();
            } else {
              this.inputStates.set(focusEvent.selector, {
                value: focusEvent.value,
                lastChange: Date.now(),
                lastCapture: Date.now(),
                capturedByKeyboard: false
              });
            }
          } else if (focusEvent.type === 'blur' && focusEvent.value) {
            console.log(`🔄 ⏭️ Ignorando blur: ${focusEvent.selector} = "${focusEvent.value}" (muito curto: ${focusEvent.valueLength} chars)`);
          }
        } catch (error) {
          console.error('❌ Erro ao processar evento de foco:', error);
        }
      }
    });

    // Injetar interceptador de foco na página
    await this.page.evaluateOnNewDocument(() => {
      document.addEventListener('blur', (event) => {
        if (event.target && (event.target as HTMLElement).matches('input, textarea, [contenteditable]')) {
          const element = event.target as HTMLInputElement;
          let selector = '';
          
          if (element.id) {
            selector = `#${element.id}`;
          } else if (element.name) {
            selector = `[name="${element.name}"]`;
          } else {
            selector = element.tagName.toLowerCase();
          }
          
          const value = element.value || element.textContent || '';
          console.log('FOCUS_EVENT:' + JSON.stringify({
            type: 'blur',
            selector,
            value,
            inputType: element.type || 'text',
            tagName: element.tagName.toLowerCase(),
            valueLength: value.length
          }));
        }
      }, true);
    });

    console.log('✅ Interceptação de foco/blur configurada');
    
    this.eventListeners.set('input', () => {});
    this.eventListeners.set('input-key', () => {});
    this.eventListeners.set('input-blur', () => {});
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
   * Configurar listener para teclas especiais (melhorado)
   */
  private async setupKeyPressListener(): Promise<void> {
    const keyHandler = async (event: any) => {
      if (!this.shouldCaptureEvent()) return;

      // Capturar teclas especiais e de navegação
      const specialKeys = ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      
      if (specialKeys.includes(event.key)) {
        // Para TAB e ENTER, também verificar se há campo ativo para capturar valor
        if ((event.key === 'Tab' || event.key === 'Enter') && event.target && 
            event.target.matches && event.target.matches('input, textarea, [contenteditable]')) {
          // Este evento será tratado pelo inputHandler via keyHandler específico
          return;
        }

        await this.addEvent({
          type: 'key_press',
          value: event.key,
          selector: event.target ? await this.getElementSelector(event.target) : undefined,
          metadata: {
            code: event.code,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            targetType: event.target?.tagName?.toLowerCase(),
            isNavigationKey: ['Tab', 'Enter'].includes(event.key)
          }
        });
      }
    };

    await this.page.evaluateOnNewDocument(() => {
      document.addEventListener('keydown', (event) => {
        (window as any).__recordingGlobalKeyHandler?.(event);
      }, true);
    });

    await this.page.exposeFunction('__recordingGlobalKeyHandler', keyHandler);
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
    const broadcastMessage = {
      type: 'recording_event',
      message: `Evento capturado: ${event.type}`,
      sessionId: this.recording.sessionId,
      recordingId: this.recording.id,
      data: event
    };
    
    this.broadcastFn(broadcastMessage);

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
   * Mascarar valores sensíveis (DESABILITADO - captura completa)
   */
  private maskSensitiveValue(value: string, inputType?: string): string {
    // Retorna o valor completo sem mascaramento
    // Todas as informações digitadas são capturadas integralmente
    return value || '';
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
