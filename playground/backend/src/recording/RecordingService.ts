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
    // Configurar listener de console para debug ANTES de outros listeners
    await this.setupConsoleListener();

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

    // Form interaction events (new)
    if (events.includes('form')) {
      // await this.setupFormListener_Legacy();
      await this.setupCDPFormListener();
    }
  }

  /**
   * Configurar listener para clicks
   */
  private async setupClickListener(): Promise<void> {
    console.log('🖱️ Configurando listener de clicks...');

    const clickHandler = async (event: any) => {
      if (!this.shouldCaptureEvent()) return;

      // Se a captura de formulário estiver ativa, verificar se o clique foi em um campo de formulário
      if (this.config.events.includes('form')) {
        const targetTagName = (event.target?.tagName || '').toLowerCase();
        if (['input', 'textarea', 'select'].includes(targetTagName)) {
          // O evento de foco será tratado pelo setupFormListener
          return;
        }
      }

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

    // CORREÇÃO: Tentar expor função, ignorar se já existir
    try {
      await this.page.exposeFunction('__recordingClickHandler', clickHandler);
      console.log('✅ Função de click exposta com sucesso');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Função de click já existe, reutilizando...');
        // Função já existe, continuar normalmente
      } else {
        console.error('❌ Erro ao expor função de click:', error);
        throw error;
      }
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

    try {
      await this.page.exposeFunction('__recordingScrollHandler', scrollHandler);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Função de scroll já existe, reutilizando...');
      } else {
        throw error;
      }
    }
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

    try {
      await this.page.exposeFunction('__recordingHoverHandler', hoverHandler);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Função de hover já existe, reutilizando...');
      } else {
        throw error;
      }
    }
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
          // Este evento será tratado pelo inputHandler ou pelo novo formListener
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

    try {
      await this.page.exposeFunction('__recordingGlobalKeyHandler', keyHandler);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Função de key já existe, reutilizando...');
      } else {
        throw error;
      }
    }
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

    try {
      await this.page.exposeFunction('__recordingSubmitHandler', submitHandler);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Função de submit já existe, reutilizando...');
      } else {
        throw error;
      }
    }
    this.eventListeners.set('submit', submitHandler);
  }

  /**
   * Configurar um listener para a console do browser para debug
   */
  private async setupConsoleListener(): Promise<void> {
    this.page.on('console', (msg) => {
      const text = msg.text();
      // Ignorar mensagens que já são tratadas por outros listeners legados
      if (text.startsWith('KEYBOARD_EVENT:') || text.startsWith('FOCUS_EVENT:')) {
        return;
      }
      console.log(`[Browser Console]: ${text}`);
    });
    console.log('📡 Listener da console do browser configurado.');
  }

  /**
   * Configurar listener unificado para interações de formulário via CDP (Chrome DevTools Protocol)
   * Esta é uma abordagem mais robusta que a injeção de script padrão.
   */
  private async setupCDPFormListener(): Promise<void> {
    console.log('📝 Configurando listener de formulários via CDP...');

    try {
      const client = await this.page.target().createCDPSession();

      // Habilitar domínios necessários
      await client.send('Runtime.enable');
      await client.send('Page.enable');
      
      // Função para configurar o binding
      const setupBinding = async () => {
        try {
          // Criar o binding
          await client.send('Runtime.addBinding', { name: 'formEventBinding' });
          console.log('✅ CDP binding criado: formEventBinding');
          
          // Injetar o script na página atual
          await client.send('Runtime.evaluate', {
            expression: `
              // Debug: verificar se o binding foi criado
              console.log('[RECORDER] Binding available:', typeof window.formEventBinding);
              
              // Armazenar o timestamp da última captura para evitar duplicidade
              window.__lastInputChangeTimes = window.__lastInputChangeTimes || {};

              const getElementDetails = (element) => {
                if (!element) return { selector: 'unknown', tagName: 'unknown', inputType: 'unknown', label: '', value: '' };
                try {
                    let selector = 'unknown';
                    if (element.id) selector = '#' + element.id;
                    else if (element.name) selector = '[name="' + element.name + '"]';
                    else if (element.className && typeof element.className === 'string') {
                        const classes = element.className.trim().split(/\\s+/).map(c => '.' + c).join('');
                        if (classes) selector = element.tagName.toLowerCase() + classes;
                    } else {
                        selector = element.tagName.toLowerCase();
                    }

                    let label = '';
                    if (element.id) {
                        const labelEl = document.querySelector('label[for="' + element.id + '"]');
                        if (labelEl) label = labelEl.textContent?.trim() || '';
                    }
                    if (!label) {
                        label = element.placeholder || element.name || '';
                    }

                    return {
                        selector,
                        tagName: element.tagName.toLowerCase(),
                        inputType: element.type || 'textarea',
                        label,
                        value: element.value || ''
                    };
                } catch (e) {
                    console.error('[RECORDER SCRIPT] Error in getElementDetails:', e);
                    return { selector: 'error', tagName: 'error', inputType: 'error', label: 'error', value: '' };
                }
              };

              const sendEventToBackend = (data) => {
                try {
                  if (typeof window.formEventBinding === 'function') {
                    console.log('[RECORDER] Sending event:', data.type, data.selector);
                    window.formEventBinding(JSON.stringify(data));
                  } else {
                    console.error('[RECORDER] formEventBinding not available!');
                  }
                } catch (e) {
                  console.error('[RECORDER] Error sending event:', e);
                }
              };
              
              const eventHandler = (event) => {
                try {
                  const target = event.target;
                  console.log('[RECORDER] Event captured:', event.type, 'on', target.tagName);
                  
                  if (!target || !target.matches || !target.matches('input, textarea, select')) return;

                  const details = getElementDetails(target);
                  const now = Date.now();

                  switch (event.type) {
                    case 'focusin':
                      console.log('[RECORDER] Focusin on:', details.selector);
                      sendEventToBackend({ type: 'focus', ...details });
                      break;
                    
                    case 'focusout':
                      const lastCaptureTime = window.__lastInputChangeTimes[details.selector] || 0;
                      if (now - lastCaptureTime > 100) {
                          console.log('[RECORDER] Focusout on:', details.selector, 'value:', details.value);
                          sendEventToBackend({ type: 'input_change', ...details });
                      }
                      break;
                      
                    case 'keydown':
                      if (event.key === 'Tab' || event.key === 'Enter') {
                          console.log('[RECORDER] Key navigation:', event.key, 'on:', details.selector);
                          window.__lastInputChangeTimes[details.selector] = now;
                          sendEventToBackend({ type: 'input_change', ...details });
                          sendEventToBackend({ type: 'navigation', key: event.key, ...details });
                      }
                      break;
                  }
                } catch (e) {
                  console.error('[RECORDER SCRIPT] Error in event handler:', e);
                }
              };

              // Remover listeners existentes se houver
              if (window.__formEventHandlerInstalled) {
                document.removeEventListener('focusin', eventHandler, true);
                document.removeEventListener('focusout', eventHandler, true);
                document.removeEventListener('keydown', eventHandler, true);
              }

              // Adicionar listeners na fase de CAPTURA para máxima prioridade
              document.addEventListener('focusin', eventHandler, true);
              document.addEventListener('focusout', eventHandler, true);
              document.addEventListener('keydown', eventHandler, true);
              
              window.__formEventHandlerInstalled = true;
              console.log('[RECORDER] Event handlers installed successfully');
            `
          });
          
        } catch (error) {
          console.error('❌ Erro ao configurar binding:', error);
        }
      };

      // Configurar o binding inicialmente
      await setupBinding();

      // Reconfigurar o binding a cada navegação
      client.on('Page.frameNavigated', async (event) => {
        if (event.frame.parentId) return; // Ignorar subframes
        console.log('🔄 Página navegada, reconfigurando binding...');
        await setupBinding();
      });

      // Escutar por eventos que chegam na "ponte"
      client.on('Runtime.bindingCalled', async (event) => {
        if (event.name === 'formEventBinding') {
          if (!this.shouldCaptureEvent()) return;

          try {
            const eventData = JSON.parse(event.payload);
            console.log(`[CDP Binding Called]: ${eventData.type}`, eventData.selector);

            switch (eventData.type) {
              case 'focus':
                await this.addEvent({
                  type: 'form_focus',
                  selector: eventData.selector,
                  metadata: {
                    tagName: eventData.tagName,
                    inputType: eventData.inputType,
                    label: eventData.label,
                    action: `User focused on field '${eventData.label || eventData.selector}'`
                  }
                });
                break;

              case 'input_change':
                if (eventData.value && eventData.value.length > 0) {
                  await this.addEvent({
                    type: 'form_input_change',
                    selector: eventData.selector,
                    value: this.maskSensitiveValue(eventData.value, eventData.inputType),
                    metadata: {
                      tagName: eventData.tagName,
                      inputType: eventData.inputType,
                      label: eventData.label,
                      valueLength: eventData.value.length,
                      action: `User filled field '${eventData.label || eventData.selector}'`
                    }
                  });
                }
                break;

              case 'navigation':
                await this.addEvent({
                  type: 'form_navigation',
                  selector: eventData.selector,
                  value: eventData.key,
                  metadata: {
                    tagName: eventData.tagName,
                    inputType: eventData.inputType,
                    label: eventData.label,
                    key: eventData.key,
                    action: `User pressed '${eventData.key}' to navigate from field '${eventData.label || eventData.selector}'`
                  }
                });
                break;
            }
          } catch (error) {
            console.error('❌ Erro ao processar evento do binding:', error);
          }
        }
      });

      console.log('✅ Listener de formulários via CDP binding configurado com sucesso.');

    } catch (error) {
      console.error('❌ Falha ao configurar listener de formulários via CDP:', error);
    }
  }

  /**
   * Configurar listener unificado para interações de formulário
   */
  private async setupFormListener_Legacy(): Promise<void> {
    console.log('📝 Configurando listener unificado de formulários...');

    const formEventHandler = async (eventData: any) => {
      if (!this.shouldCaptureEvent()) return;

      console.log(`📝 Evento de formulário recebido:`, eventData);

      switch (eventData.type) {
        case 'focus':
          await this.addEvent({
            type: 'form_focus',
            selector: eventData.selector,
            metadata: {
              tagName: eventData.tagName,
              inputType: eventData.inputType,
              label: eventData.label,
              action: `User focused on field '${eventData.label || eventData.selector}'`
            }
          });
          break;

        case 'input_change':
          // Apenas capturar se houver valor
          if (eventData.value && eventData.value.length > 0) {
            await this.addEvent({
              type: 'form_input_change',
              selector: eventData.selector,
              value: this.maskSensitiveValue(eventData.value, eventData.inputType),
              metadata: {
                tagName: eventData.tagName,
                inputType: eventData.inputType,
                label: eventData.label,
                valueLength: eventData.value.length,
                action: `User filled field '${eventData.label || eventData.selector}'`
              }
            });
          }
          break;

        case 'navigation':
          await this.addEvent({
            type: 'form_navigation',
            selector: eventData.selector,
            value: eventData.key,
            metadata: {
              tagName: eventData.tagName,
              inputType: eventData.inputType,
              label: eventData.label,
              key: eventData.key,
              action: `User pressed '${eventData.key}' to navigate from field '${eventData.label || eventData.selector}'`
            }
          });
          break;
      }
    };

    // Expor a função que receberá os eventos do browser
    await this.page.exposeFunction('__recordingFormEventHandler', formEventHandler);

    // Injetar o script no navegador para capturar as interações de formulário
    await this.page.evaluateOnNewDocument(() => {
      // Armazenar o timestamp da última captura para evitar duplicidade
      (window as any).__lastInputChangeTimes = (window as any).__lastInputChangeTimes || {};

      const getElementLabel = (element: HTMLElement): string => {
        try {
          if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent?.trim() || '';
          }
          const parent = element.parentElement;
          if (parent) {
            const label = parent.querySelector('label');
            if (label) return label.textContent?.trim() || '';
          }
          return (element as HTMLInputElement).placeholder || (element as HTMLInputElement).name || '';
        } catch (e) {
          console.error('Recording script error in getElementLabel:', e);
          return '';
        }
      };
      
      const getElementSelector = (element: HTMLElement): string => {
        try {
          if (element.id) return `#${element.id}`;
          if (element.name) return `[name="${element.name}"]`;
          // Tornar a verificação de className mais robusta
          if (element.className && typeof element.className === 'string') {
            const classes = element.className.trim().split(/\s+/).map(c => `.${c}`).join('');
            if(classes) return `${element.tagName.toLowerCase()}${classes}`;
          }
          return element.tagName.toLowerCase();
        } catch (e) {
            console.error('Recording script error in getElementSelector:', e);
            return 'unknown';
        }
      };

      const createEventData = (element: HTMLInputElement | HTMLTextAreaElement) => {
        return {
          selector: getElementSelector(element),
          tagName: element.tagName.toLowerCase(),
          inputType: (element as HTMLInputElement).type || 'textarea',
          label: getElementLabel(element),
          value: element.value
        };
      };

      // Adicionar listeners de depuração adicionais
      document.addEventListener('mousedown', (event) => {
        try {
          const target = event.target as HTMLElement;
          const targetInfo = target ? `tagName: ${target.tagName}, id: ${target.id}, name: ${target.name}` : 'null';
          console.log(`[RECORDER DEBUG] mousedown event. Target -> ${targetInfo}`);
        } catch (e) {
          console.error('Recording script error (mousedown):', e);
        }
      }, true);

      document.addEventListener('keyup', (event) => {
        try {
          const target = event.target as HTMLElement;
          const targetInfo = target ? `tagName: ${target.tagName}` : 'null';
          console.log(`[RECORDER DEBUG] keyup event. Key: ${event.key}, Target -> ${targetInfo}`);
        } catch (e) {
          console.error('Recording script error (keyup):', e);
        }
      }, true);


      // 1. Capturar Foco
      document.addEventListener('focusin', (event) => {
        try {
          const target = event.target as HTMLInputElement;
          const targetInfo = target ? `tagName: ${target.tagName}, id: ${target.id}, name: ${target.name}` : 'null';
          console.log(`[RECORDER DEBUG] focusin event. Target -> ${targetInfo}`);
          if (target && target.matches('input, textarea, select')) {
            const eventData = {
              type: 'focus',
              ...createEventData(target)
            };
            (window as any).__recordingFormEventHandler?.(eventData);
          }
        } catch (e) {
          console.error('Recording script error (focusin):', e);
        }
      }, true); // <-- USAR FASE DE CAPTURA

      // 2. Capturar Mudança de Input (ao sair do campo)
      document.addEventListener('focusout', (event) => {
        try {
          const target = event.target as HTMLInputElement;
          if (target && target.matches('input, textarea, select')) {
            const selector = getElementSelector(target);
            const now = Date.now();
            const lastCaptureTime = (window as any).__lastInputChangeTimes[selector] || 0;

            // Se a captura foi feita pelo 'keydown' (Tab/Enter) nos últimos 50ms, ignorar
            if (now - lastCaptureTime < 50) {
              return;
            }
            
            const eventData = {
              type: 'input_change',
              ...createEventData(target)
            };
            (window as any).__recordingFormEventHandler?.(eventData);
          }
        } catch (e) {
          console.error('Recording script error (focusout):', e);
        }
      }, true); // <-- USAR FASE DE CAPTURA

      // 3. Capturar Navegação (Tab) e Submissão (Enter)
      document.addEventListener('keydown', (event) => {
        try {
          const target = event.target as HTMLInputElement;
          const targetInfo = target ? `tagName: ${target.tagName}` : 'null';
          console.log(`[RECORDER DEBUG] keydown event. Key: ${event.key}, Target -> ${targetInfo}`);
          if (target && target.matches('input, textarea, select') && (event.key === 'Tab' || event.key === 'Enter')) {
            const selector = getElementSelector(target);
            
            // Registrar o timestamp para prevenir o 'focusout' de disparar novamente
            (window as any).__lastInputChangeTimes[selector] = Date.now();

            // Primeiro, garantir que o valor atual seja capturado
            const inputChangeEventData = {
              type: 'input_change',
              ...createEventData(target)
            };
            (window as any).__recordingFormEventHandler?.(inputChangeEventData);
            
            // Depois, registrar o evento de navegação
            const navEventData = {
              type: 'navigation',
              key: event.key,
              ...createEventData(target)
            };
            (window as any).__recordingFormEventHandler?.(navEventData);
          }
        } catch (e) {
          console.error('Recording script error (keydown):', e);
        }
      }, true); // <-- USAR FASE DE CAPTURA
    });

    console.log('✅ Listener unificado de formulários configurado.');
    this.eventListeners.set('form', formEventHandler);
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
