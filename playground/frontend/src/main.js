import './style.css'
import { EditorView, keymap, highlightSpecialChars, drawSelection, rectangularSelection, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { foldGutter, indentOnInput, indentUnit, bracketMatching } from '@codemirror/language'
import { linter, lintGutter } from '@codemirror/lint'

class PlaygroundApp {
  constructor() {
    this.ws = null;
    this.config = this.loadConfig();
    this.templates = this.getTemplates();
    this.editors = {
      header: null,
      automation: null,
      footer: null,
      sessionData: null
    };
    this.currentSession = {
      id: null,
      active: false,
      executionCount: 0,
      pageInfo: null
    };
    this.extractionData = {
      hasData: false,
      timestamp: null,
      data: null
    };
    
    // Flag para evitar loops de salvamento durante carregamento
    this.isLoadingConfig = false;
    
    this.init();
  }

  init() {
    this.setupWebSocket();
    this.setupEventListeners();
    this.loadAdvancedConfigState();
    this.initCodeEditors();
    // Carregar configuração APÓS inicializar editores
    this.loadSavedConfig();
    this.checkChromeStatus();
    this.initializeIcons();
    
    // Initialize results section with empty state
    this.clearResultsContent();
    
    // Gerar código inicial após tudo estar configurado
    // Pequeno delay para garantir que todos os elementos estejam prontos
    setTimeout(() => {
      this.generateCodeAutomatically();
    }, 50);
  }
  
  initializeIcons() {
    // Aguardar Lucide estar disponível e inicializar ícones
    const initLucide = () => {
      if (typeof lucide !== 'undefined') {
        try {
          lucide.createIcons();
          console.log('Ícones Lucide inicializados com sucesso');
        } catch (error) {
          console.error('Erro ao inicializar ícones Lucide:', error);
        }
      } else {
        console.warn('Lucide não disponível ainda, tentando novamente...');
        setTimeout(initLucide, 100);
      }
    };
    
    initLucide();
  }

  // WebSocket Setup
  setupWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:3001/ws`;
    
    this.connectWebSocket(wsUrl);
  }

  connectWebSocket(url) {
    try {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        this.log('Conectado ao servidor', 'success');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Tratar mensagem de sessão expirada
          if (data.type === 'session_expired') {
            this.handleSessionExpired(data.sessionId);
          }
          
          this.log(data.message, data.type);
        } catch (error) {
          this.log(`${event.data}`, 'info');
        }
      };

      this.ws.onclose = () => {
        this.log('Conexão perdida. Tentando reconectar...', 'warning');
        setTimeout(() => this.connectWebSocket(url), 3000);
      };

      this.ws.onerror = () => {
        this.log('Erro na conexão WebSocket', 'error');
      };

    } catch (error) {
      this.log(`Erro ao conectar: ${error.message}`, 'error');
    }
  }

  // Event Listeners
  setupEventListeners() {
    // Usar event delegation para garantir que funcionará mesmo se elementos ainda não existirem
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      
      switch (target.id) {

          
        case 'executeBtn':
          e.preventDefault();
          this.executeSession();
          break;
          
        case 'sessionToggleBtn':
          e.preventDefault();
          this.toggleSession();
          break;
          
        case 'executeCodeBtn':
          e.preventDefault();
          this.executeCode();
          break;
          
        case 'takeScreenshotBtn':
          e.preventDefault();
          this.takeScreenshot();
          break;

        case 'importConfig':
          e.preventDefault();
          this.importConfig();
          break;
          
        case 'exportConfig':
          e.preventDefault();
          this.exportConfig();
          break;
          
        case 'docsBtn':
          e.preventDefault();
          this.openDocumentation();
          break;
          
        case 'closeDocsModal':
          e.preventDefault();
          this.closeDocumentation();
          break;
          
        case 'copyCodeBtn':
          e.preventDefault();
          this.copyGeneratedCode();
          break;
          
        case 'validateWSEndpoint':
          e.preventDefault();
          this.validateWebSocketEndpoint();
          break;
          

          
        case 'toggleAdvancedConfig':
          e.preventDefault();
          this.toggleAdvancedConfig();
          break;
      }
    });

    document.querySelectorAll('.template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const template = e.target.dataset.template;
        this.applyTemplate(template);
      });
    });

    // Session Data Template buttons
    document.querySelectorAll('.session-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const template = e.target.dataset.sessionTemplate;
        this.applySessionTemplate(template);
      });
    });

    // User Agent Template buttons
    document.querySelectorAll('.ua-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const template = e.target.dataset.uaTemplate;
        this.applyUserAgentTemplate(template);
      });
    });

    // Results tabs event listeners
    document.addEventListener('click', (e) => {
      if (e.target.closest('.tab-btn')) {
        const tabBtn = e.target.closest('.tab-btn');
        const tabName = tabBtn.dataset.tab;
        this.switchResultsTab(tabName);
      }
    });

    this.setupAutoSave();
    this.setupModalEventListeners();
  }

  setupAutoSave() {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.saveConfig();
        // Gerar código automaticamente quando a configuração mudar
        this.generateCodeAutomatically();
      });
    });
  }

  setupModalEventListeners() {
    // Close modal when clicking on overlay
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeDocumentation();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('docsModal');
        if (modal && modal.style.display !== 'none') {
          this.closeDocumentation();
        }
      }
    });
  }

  // Chrome Status
  async checkChromeStatus() {
    this.log('Verificando Chrome...', 'info');
    
    try {
      const response = await fetch('/api/chrome/check');
      const result = await response.json();
      
      if (result.available) {
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) executeBtn.disabled = false;
        this.log('Chrome conectado e disponível', 'success');
      } else {
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) executeBtn.disabled = true;
        this.log(`${result.error}`, 'warning');
        
        if (result.instructions) {
          this.log(`${result.instructions}`, 'info');
        }
        
        if (result.testedEndpoints) {
          this.log(`Endpoints testados: ${result.testedEndpoints.join(', ')}`, 'info');
        }
        
        if (result.troubleshooting) {
          this.log('Troubleshooting:', 'info');
          result.troubleshooting.forEach(step => {
            this.log(`   ${step}`, 'info');
          });
        }
      }
    } catch (error) {
      this.log(`Erro ao verificar Chrome: ${error.message}`, 'error');
    }
  }





  async validateWebSocketEndpoint() {
    const endpointInput = document.getElementById('browserWSEndpoint');
    const validateButton = document.getElementById('validateWSEndpoint');
    
    if (!endpointInput || !validateButton) return;
    
    const endpoint = endpointInput.value.trim();
    
    if (!endpoint) {
      this.log('Por favor, insira uma URL WebSocket para validar', 'error');
      this.showButtonError(validateButton, 'URL obrigatória', 'empty');
      return;
    }
    
    // Validar formato básico da URL
    if (!endpoint.startsWith('ws://') && !endpoint.startsWith('wss://')) {
      this.log('URL deve começar com ws:// ou wss://', 'error');
      this.showButtonError(validateButton, 'Formato inválido', 'format');
      return;
    }
    
    // Feedback visual no botão - estado de loading
    const originalContent = validateButton.innerHTML;
    validateButton.disabled = true;
    validateButton.classList.add('loading');
    validateButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 11-6.219-8.56"></path></svg><span>Validando...</span>';
    
    this.log(`Validando conexão com ${endpoint}...`, 'info');
    
    let isSuccess = false;
    let errorType = 'connection';
    
    try {
      // Extrair host e porta da URL WebSocket
      const wsUrl = new URL(endpoint);
      const httpUrl = `http://${wsUrl.host}/json/version`;
      
      // Tentar conectar ao endpoint HTTP do Chrome DevTools
      const response = await fetch(httpUrl, {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        this.log(`✅ Conexão válida! Chrome ${data.Browser || 'versão desconhecida'}`, 'success');
        this.log(`WebSocket URL: ${data.webSocketDebuggerUrl || 'N/A'}`, 'info');
        isSuccess = true;
      } else {
        this.log(`❌ Endpoint não respondeu (HTTP ${response.status})`, 'error');
        errorType = 'http';
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        this.log('❌ Timeout na conexão (5s)', 'error');
        errorType = 'timeout';
      } else if (error.message.includes('fetch')) {
        this.log('❌ Não foi possível conectar ao endpoint', 'error');
        this.log('Verifique se o Chrome está rodando com --remote-debugging-port', 'info');
        errorType = 'connection';
      } else {
        this.log(`❌ Erro na validação: ${error.message}`, 'error');
        errorType = 'unknown';
      }
    } finally {
      // Remover estado de loading
      validateButton.disabled = false;
      validateButton.classList.remove('loading');
      
      // Mostrar feedback visual baseado no resultado
      if (isSuccess) {
        this.showButtonSuccess(validateButton, originalContent);
      } else {
        this.showButtonError(validateButton, originalContent, errorType);
      }
    }
  }

  showButtonSuccess(button, originalContent) {
    // Mostrar estado de sucesso
    button.classList.add('success');
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg><span>Conectado!</span>';
    
    // Voltar ao estado original após 3 segundos
    setTimeout(() => {
      button.classList.remove('success');
      button.innerHTML = originalContent;
      lucide.createIcons();
    }, 3000);
  }

  showButtonError(button, originalContent, errorType = 'connection') {
    // Se originalContent é uma string simples (mensagem de erro), usar conteúdo padrão
    const defaultContent = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg><span>Validar conexão</span>';
    const contentToRestore = typeof originalContent === 'string' && originalContent.includes('svg') ? originalContent : defaultContent;
    
    // Definir mensagem e ícone baseado no tipo de erro
    let errorMessage, errorIcon;
    
    switch (errorType) {
      case 'empty':
        errorMessage = 'URL vazia';
        errorIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        break;
      case 'format':
        errorMessage = 'URL inválida';
        errorIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        break;
      case 'timeout':
        errorMessage = 'Timeout';
        errorIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12,6 12,12 16,14"></polyline></svg>';
        break;
      case 'http':
        errorMessage = 'Sem resposta';
        errorIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';
        break;
      case 'connection':
        errorMessage = 'Sem conexão';
        errorIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        break;
      default:
        errorMessage = 'Falha';
        errorIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    }
    
    // Mostrar estado de erro
    button.classList.add('error');
    button.innerHTML = `${errorIcon}<span>${errorMessage}</span>`;
    
    // Voltar ao estado original após 2.5 segundos
    setTimeout(() => {
      button.classList.remove('error');
      button.innerHTML = contentToRestore;
      lucide.createIcons();
    }, 2500);
  }

  // Utilities
  log(message, type = 'info') {
    const logsContainer = document.getElementById('logs');
    if (!logsContainer) return;
    
    const timestamp = new Date().toLocaleTimeString();
    
    // Mapear tipos para labels
    const typeLabels = {
      'info': '[INFO]',
      'success': '[SUCCESS]',
      'error': '[ERROR]',
      'warning': '[WARNING]'
    };
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type} fade-in`;
    logEntry.innerHTML = `
      <span class="log-time">${timestamp}</span>
      <span class="log-type">${typeLabels[type] || '[INFO]'}</span>
      <span class="log-message">${message}</span>
    `;
    
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;

    const logs = logsContainer.children;
    if (logs.length > 100) {
      logsContainer.removeChild(logs[0]);
    }
  }

  setLoading(loading) {
    const executeBtn = document.getElementById('executeBtn');
    if (!executeBtn) return;
    
    if (loading) {
      executeBtn.disabled = true;
      executeBtn.innerHTML = '<div class="spinner"></div> Executando...';
    } else {
      executeBtn.disabled = false;
      executeBtn.innerHTML = '<i data-lucide="play"></i> Executar';
      // Re-inicializar ícones após mudança de conteúdo
      try {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      } catch (error) {
        console.warn('Erro ao re-inicializar ícones do botão:', error);
      }
    }
  }

  // Execute Session
  async executeSession() {
    const config = this.getConfigFromForm();
    
    if (!this.validateConfig(config)) {
      return;
    }

    // Verificar se há código editado para incluir na execução
    let customCode = '';
    if (this.editors.header && this.editors.automation && this.editors.footer) {
      const headerCode = this.editors.header.state.doc.toString();
      const automationCode = this.editors.automation.state.doc.toString();
      const footerCode = this.editors.footer.state.doc.toString();
      
      customCode = `${headerCode}\n\n${automationCode}\n\n${footerCode}`;
    }
    
    // Adicionar código customizado à configuração se disponível
    if (customCode && customCode.trim() && !customCode.includes('// Configure os parâmetros acima')) {
      config.customCode = customCode;
    }

    this.log('🚀 Executando sessão...', 'info');
    this.setLoading(true);

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });

      const result = await response.json();

      if (response.ok) {
        this.log(`${result.message}`, 'success');
        if (result.pageInfo) {
          this.log(`${result.pageInfo.title} - ${result.pageInfo.url}`, 'info');
        }
      } else {
        this.log(`${result.error}`, 'error');
      }

    } catch (error) {
      this.log(`Erro na execução: ${error.message}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  // Create new session
  async createSession() {
    const config = this.getConfigFromForm();
    
    if (!this.validateConfig(config)) {
      return;
    }

    this.log('🆔 Criando nova sessão...', 'info');
    this.setLoading(true);

    try {
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });

      const result = await response.json();

      if (response.ok) {
        this.currentSession = {
          id: result.sessionId,
          active: true,
          executionCount: 0,
          pageInfo: result.pageInfo
        };
        
        this.updateSessionStatus();
        this.log(`✅ Sessão criada: ${result.sessionId}`, 'success');
        
        if (result.pageInfo) {
          this.log(`📍 Página: ${result.pageInfo.title} - ${result.pageInfo.url}`, 'info');
        }
      } else {
        this.log(`❌ Erro ao criar sessão: ${result.error}`, 'error');
      }

    } catch (error) {
      this.log(`Erro ao criar sessão: ${error.message}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  // Execute code in current session
  async executeCode() {
    if (!this.currentSession.active) {
      this.log('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.', 'error');
      return;
    }

    // Get code from automation editor
    const code = this.editors.automation ? this.editors.automation.state.doc.toString() : '';
    
    // Remove comments and whitespace to check if there's actual code
    const codeWithoutComments = code
      .replace(/\/\/.*$/gm, '') // Remove single line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .trim();
    
    if (!codeWithoutComments) {
      this.log('❌ Escreva algum código na seção "Código da Automação" primeiro.', 'error');
      return;
    }

    this.log('🚀 Executando código na sessão ativa...', 'info');
    this.setLoading(true);

    try {
      const response = await fetch('/api/session/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.currentSession.id,
          code: code
        })
      });

      const result = await response.json();

      if (response.ok) {
        this.currentSession.executionCount++;
        this.currentSession.pageInfo = result.pageInfo;
        
        this.updateSessionStatus();
        this.log(`✅ Código executado com sucesso!`, 'success');
        
        // Show results section
        this.showResults(result);
        
      } else {
        // Verificar se é erro de sessão expirada
        if (result.sessionExpired) {
          this.handleSessionExpired(this.currentSession.id);
        }
        this.log(`❌ Erro na execução: ${result.error}`, 'error');
      }

    } catch (error) {
      this.log(`Erro na execução: ${error.message}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  // Take screenshot of current session
  async takeScreenshot() {
    if (!this.currentSession.active) {
      this.log('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.', 'error');
      return;
    }

    this.log('📸 Capturando screenshot...', 'info');
    this.setLoading(true);

    try {
      const response = await fetch('/api/session/screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.currentSession.id,
          options: {
            fullPage: false
          }
        })
      });

      const result = await response.json();

      if (response.ok) {
        this.log(`✅ Screenshot capturado!`, 'success');
        this.showScreenshot(result.screenshot);
      } else {
        // Verificar se é erro de sessão expirada
        if (result.sessionExpired) {
          this.handleSessionExpired(this.currentSession.id);
        }
        this.log(`❌ Erro ao capturar screenshot: ${result.error}`, 'error');
      }

    } catch (error) {
      this.log(`Erro ao capturar screenshot: ${error.message}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  // Close current session
  async closeSession() {
    if (!this.currentSession.active) {
      this.log('❌ Nenhuma sessão ativa.', 'error');
      return;
    }

    this.log('🗑️ Fechando sessão...', 'info');
    this.setLoading(true);

    try {
      // Executar código de extração de dados antes de fechar
      const footerCode = this.editors.footer?.state.doc.toString();
      
      // Executar se há código (incluindo o código padrão)
      if (footerCode && footerCode.trim() && !footerCode.trim().startsWith('//') || 
          (footerCode && footerCode.includes('return'))) {
        this.log('📊 Executando extração de dados antes do fechamento...', 'info');
        
        try {
          const executeResponse = await fetch('/api/session/execute', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              sessionId: this.currentSession.id,
              code: footerCode 
            })
          });

          const executeResult = await executeResponse.json();
          
          if (executeResponse.ok) {
            this.log('✅ Extração de dados concluída!', 'success');
            if (executeResult.result) {
              this.log(`📋 Dados extraídos: ${JSON.stringify(executeResult.result, null, 2)}`, 'info');
              
              // Exibir dados na aba "Dados" dos resultados
              this.showExtractionData(executeResult.result);
              this.switchResultsTab('data');
            }
          } else {
            this.log(`⚠️ Erro na extração de dados: ${executeResult.error}`, 'warning');
          }
        } catch (extractError) {
          this.log(`⚠️ Erro ao executar extração: ${extractError.message}`, 'warning');
        }
      }

      // Fechar sessão
      const response = await fetch(`/api/session/${this.currentSession.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (response.ok) {
        this.currentSession = {
          id: null,
          active: false,
          executionCount: 0,
          pageInfo: null
        };
        
        this.updateSessionStatus();
        // NÃO limpar resultados - dados devem persistir após fechamento
        this.log(`✅ Sessão fechada com sucesso!`, 'success');
      } else {
        this.log(`❌ Erro ao fechar sessão: ${result.error}`, 'error');
      }

    } catch (error) {
      this.log(`Erro ao fechar sessão: ${error.message}`, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  // Toggle session (create or close)
  async toggleSession() {
    if (this.currentSession.active) {
      await this.closeSession();
    } else {
      await this.createSession();
    }
  }

  // Update session status UI (controla botão unificado e outros botões)
  updateSessionStatus() {
    // Session control buttons
    const sessionToggleBtn = document.getElementById('sessionToggleBtn');
    const executeBtn = document.getElementById('executeCodeBtn');
    const screenshotBtn = document.getElementById('takeScreenshotBtn');

    if (this.currentSession.active) {
      // Session is active - show close button
      sessionToggleBtn.className = 'btn btn-danger';
      sessionToggleBtn.title = 'Fechar sessão ativa';
      sessionToggleBtn.innerHTML = '<i data-lucide="x-circle"></i>Fechar Sessão';
      
      // Enable other session buttons
      executeBtn.disabled = false;
      screenshotBtn.disabled = false;
      
    } else {
      // Session is inactive - show create button
      sessionToggleBtn.className = 'btn btn-success';
      sessionToggleBtn.title = 'Criar nova sessão Puppeteer';
      sessionToggleBtn.innerHTML = '<i data-lucide="plus-circle"></i>Criar Sessão';
      
      // Disable other session buttons
      executeBtn.disabled = true;
      screenshotBtn.disabled = true;
    }
    
    // Re-initialize lucide icons for the updated button
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Show results section
  showResults(result) {
    // A seção de resultados agora está sempre visível
    // Apenas atualizar o conteúdo
    
    // Update page info
    this.updatePageInfo(result.pageInfo);
    
    // NÃO mostrar dados de execução normal na aba "Dados"
    // A aba "Dados" é reservada apenas para dados de extração
  }

  // Hide results section (agora apenas limpa o conteúdo)
  hideResults() {
    // A seção permanece visível, apenas limpar conteúdo
    this.clearResultsContent();
  }

  // Clear results content
  clearResultsContent() {
    // Limpar screenshot
    const screenshotContainer = document.getElementById('screenshotContainer');
    screenshotContainer.innerHTML = '<p class="empty-state">Nenhum screenshot capturado ainda</p>';
    
    // NÃO limpar dados de extração - eles devem persistir
    // Apenas limpar se não houver dados de extração salvos
    if (!this.extractionData.hasData) {
      const dataContainer = document.getElementById('dataContainer');
      dataContainer.innerHTML = '<pre class="code-output"><code>// Dados extraídos aparecerão aqui...</code></pre>';
    }
    
    // Limpar info da página
    document.getElementById('currentUrl').textContent = '-';
    document.getElementById('currentTitle').textContent = '-';
    document.getElementById('lastUpdate').textContent = '-';
  }

  // Show screenshot in results
  showScreenshot(screenshotDataUrl) {
    const screenshotContainer = document.getElementById('screenshotContainer');
    
    screenshotContainer.innerHTML = `
      <img src="${screenshotDataUrl}" alt="Screenshot da página" />
      <p style="margin-top: 10px; font-size: 12px; color: #a0aec0;">
        Screenshot capturado em ${new Date().toLocaleString()}
      </p>
    `;
    
    // Switch to screenshot tab
    this.switchResultsTab('screenshot');
  }

  // Show execution data (DEPRECATED - não usado mais)
  showExecutionData(data) {
    // Este método não é mais usado - a aba "Dados" é reservada para extração
    console.warn('showExecutionData is deprecated - use showExtractionData instead');
  }

  // Show extraction data (dados do código de extração)
  showExtractionData(data) {
    const dataContainer = document.getElementById('dataContainer');
    
    // Salvar dados de extração com timestamp
    this.extractionData = {
      hasData: true,
      timestamp: new Date(),
      data: data
    };
    
    let displayData;
    if (data === undefined || data === null) {
      displayData = '// Nenhum dado extraído ainda';
      this.extractionData.hasData = false;
    } else if (typeof data === 'object') {
      displayData = JSON.stringify(data, null, 2);
    } else {
      displayData = String(data);
    }
    
    dataContainer.innerHTML = `<pre class="code-output"><code>${displayData}</code></pre>`;
    
    // Atualizar badge de timestamp
    this.updateExtractionBadge();
  }

  // Update extraction badge with timestamp
  updateExtractionBadge() {
    let badgeElement = document.getElementById('extractionBadge');
    
    if (this.extractionData.hasData && this.extractionData.timestamp) {
      const timeString = this.extractionData.timestamp.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      if (!badgeElement) {
        // Criar badge se não existir
        const resultsTitle = document.querySelector('#resultsSection h3');
        badgeElement = document.createElement('span');
        badgeElement.id = 'extractionBadge';
        badgeElement.className = 'extraction-badge';
        resultsTitle.appendChild(badgeElement);
      }
      
      badgeElement.textContent = `Última extração: ${timeString}`;
      badgeElement.style.display = 'inline-block';
    } else if (badgeElement) {
      badgeElement.style.display = 'none';
    }
  }

  // Update page info in results
  updatePageInfo(pageInfo) {
    if (!pageInfo) return;
    
    const currentUrl = document.getElementById('currentUrl');
    const currentTitle = document.getElementById('currentTitle');
    const lastUpdate = document.getElementById('lastUpdate');
    
    currentUrl.textContent = pageInfo.url || '-';
    currentTitle.textContent = pageInfo.title || '-';
    lastUpdate.textContent = pageInfo.timestamp ? new Date(pageInfo.timestamp).toLocaleString() : '-';
  }

  // Switch results tab
  switchResultsTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
  }

  // Handle session expired
  handleSessionExpired(sessionId) {
    // Verificar se é a sessão atual
    if (this.currentSession.id === sessionId) {
      // Resetar estado da sessão
      this.currentSession = {
        id: null,
        active: false,
        executionCount: 0,
        pageInfo: null
      };
      
      // Atualizar interface
      this.updateSessionStatus();
      this.hideResults();
      
      this.log('🔄 Sessão resetada automaticamente devido à expiração.', 'warning');
    }
  }

  // Generate Code Automatically (local generation)
  generateCodeAutomatically() {
    // Não gerar código automaticamente se houver configuração salva para os editores
    const savedConfig = this.loadConfig();
    if (savedConfig.automationCode !== undefined || savedConfig.footerCode !== undefined) {
      console.log('📝 Código personalizado encontrado, pulando geração automática para automação/footer.');
    }

    const config = this.getConfigFromForm();
    
    // Gerar código localmente sem requisição HTTP
    const codeSections = this.generateCodeSections(config);

    // Se houver código salvo (incluindo vazio), não sobrescrever
    if (savedConfig.automationCode !== undefined) {
      delete codeSections.automation;
    }
    if (savedConfig.footerCode !== undefined) {
      delete codeSections.footer;
    }

    this.displayGeneratedCodeSections(codeSections);
  }

  // Generate Code Sections (local generation)
  generateCodeSections(config) {
    // Use user-defined browserWSEndpoint or fallback to default
    const configWithEndpoint = {
      ...config,
      browserWSEndpoint: config.browserWSEndpoint || 'ws://host.docker.internal:9222' // Use user-defined or default
    };
    
    // Remover propriedades que são apenas para persistência da UI, não para a execução do bot
    delete configWithEndpoint.automationCode;
    delete configWithEndpoint.footerCode;
    
    const configJson = JSON.stringify(configWithEndpoint, null, 2);
    
    return {
      header: `import { newPage } from '@felinto-dev/felinto-connect-bot';

// Criar página
const page = await newPage(${configJson});`,

      automation: `// Testes básicos na página atual
const title = await page.title();
const h1Text = await page.$eval('h1', el => el.textContent);
const linksCount = await page.$$eval('a', links => links.length);

console.log('Título:', title);
console.log('H1:', h1Text);
console.log('Links encontrados:', linksCount);`,

      footer: `// Capturar informações finais
const finalUrl = await page.url();
const finalTitle = await page.title();

return {
  finalUrl,
  finalTitle,
}`
    };
  }

  // Initialize Code Editors
  initCodeEditors() {
    this.initSingleEditor('headerEditor', 'header', '// Configure os parâmetros acima para gerar o código automaticamente...', true); // readonly
    this.initSingleEditor('automationEditor', 'automation', '// Suas automações personalizadas aqui...');
    this.initSingleEditor('footerEditor', 'footer', `// Capturar informações finais
const finalUrl = await page.url();
const finalTitle = await page.title();

return {
  finalUrl,
  finalTitle,
}`);
    
    // Inicializar editor JSON para sessionData
    this.initSessionDataEditor();
    
    // Garantir que auto-save funcione com editores CodeMirror
    this.setupCodeMirrorAutoSave();
  }

  // Initialize Session Data Editor (JSON)
  initSessionDataEditor() {
    const textarea = document.getElementById('sessionData');
    if (!textarea) return;
    
    // Obter valor atual do textarea
    const currentValue = textarea.value || '{\n  "localStorage": {\n    "userPreferred_language": "pt-BR",\n    "currency": "BRL"\n  }\n}';
    
    // Criar container para o editor
    const editorContainer = document.createElement('div');
    editorContainer.className = 'session-data-editor';
    editorContainer.style.cssText = 'border: 1px solid #333; border-radius: 4px; overflow: hidden;';
    
    // Substituir textarea pelo container do editor
    textarea.parentNode.insertBefore(editorContainer, textarea);
    textarea.style.display = 'none';
    
    // Configurar extensões para JSON
    const extensions = [
      // Funcionalidades básicas
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      
      // Linting para JSON
      lintGutter(),
      this.createJsonLinter(),
      
      // Keymaps
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
        // Adicionar comando para formatação manual (Ctrl+Shift+F)
        {
          key: 'Ctrl-Shift-f',
          run: (view) => {
            this.formatJsonInEditor(view);
            return true;
          }
        }
      ]),
      
      // Linguagem JSON e tema
      json(),
      oneDark,
      
      // Configurações customizadas
      indentUnit.of('  '), // 2 espaços para indentação
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          fontSize: '12px',
          fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
        },
        '.cm-focused': {
          outline: 'none'
        },
        '.cm-editor': {
          height: 'auto'
        },
        '.cm-scroller': {
          fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
        }
      }),
      
      // Listener para sincronizar com textarea e formatar JSON apenas ao colar
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          textarea.value = update.state.doc.toString();
          // Disparar evento input para auto-save funcionar
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Detectar se foi uma operação de cola (mudança grande de uma vez)
          const isLargeChange = update.changes.desc.length > 50;
          
          if (isLargeChange) {
            // Formatar imediatamente apenas se foi uma cola
            setTimeout(() => this.formatJsonInEditor(update.view), 100);
          }
          // Removido: formatação automática durante digitação
        }
      })
    ];

    // Configurar estado inicial do editor
    const startState = EditorState.create({
      doc: currentValue,
      extensions: extensions
    });
    
    // Criar instância do editor
    this.editors.sessionData = new EditorView({
      state: startState,
      parent: editorContainer
    });
  }

  // Setup auto-save for CodeMirror editors
  setupCodeMirrorAutoSave() {
    // O editor sessionData já dispara eventos 'input' no textarea oculto
    // que são capturados pelo setupAutoSave() existente.
    // Este método é para garantir que funcione e para futuras extensões.
    
    // Verificar se o textarea sessionData está sendo monitorado
    const sessionDataTextarea = document.getElementById('sessionData');
    if (sessionDataTextarea) {
      // Garantir que o listener de input está ativo
      const hasListener = sessionDataTextarea.getAttribute('data-autosave-setup');
      if (!hasListener) {
        sessionDataTextarea.addEventListener('input', () => {
          this.saveConfig();
          this.generateCodeAutomatically();
        });
        sessionDataTextarea.setAttribute('data-autosave-setup', 'true');
      }
    }
  }

  // JSON Linter function for CodeMirror
  createJsonLinter() {
    return linter((view) => {
      const diagnostics = [];
      const content = view.state.doc.toString();
      
      if (!content.trim()) {
        return diagnostics; // Não mostrar erros para conteúdo vazio
      }
      
      try {
        // Tentar corrigir JSON comum com chaves sem aspas
        let correctedJson = content;
        const needsCorrection = correctedJson.includes('cookies:') || 
                               correctedJson.includes('localStorage:') || 
                               correctedJson.includes('sessionStorage:');
        
        if (needsCorrection) {
          correctedJson = correctedJson
            .replace(/(\s*)cookies(\s*):/g, '$1"cookies"$2:')
            .replace(/(\s*)localStorage(\s*):/g, '$1"localStorage"$2:')
            .replace(/(\s*)sessionStorage(\s*):/g, '$1"sessionStorage"$2:');
        }
        
        // Tentar fazer parse do JSON
        JSON.parse(correctedJson);
        
        // Se chegou aqui, o JSON é válido
        if (needsCorrection) {
          // Mostrar aviso sobre correção automática disponível
          diagnostics.push({
            from: 0,
            to: content.length,
            severity: 'info',
            message: '💡 JSON pode ser corrigido automaticamente. Cole novamente ou use Ctrl+Shift+F para formatar.'
          });
        }
        
      } catch (error) {
        // JSON inválido - mostrar erro
        let errorMessage = error.message;
        let errorPosition = 0;
        
        // Tentar extrair posição do erro se disponível
        const positionMatch = errorMessage.match(/position (\d+)/);
        if (positionMatch) {
          errorPosition = parseInt(positionMatch[1]);
        }
        
        // Melhorar mensagens de erro comuns
        if (errorMessage.includes('Unexpected token')) {
          if (content.includes('cookies:')) {
            errorMessage = 'Chaves devem estar entre aspas. Use "cookies" ao invés de cookies';
          } else if (content.includes('localStorage:')) {
            errorMessage = 'Chaves devem estar entre aspas. Use "localStorage" ao invés de localStorage';
          } else if (content.includes('sessionStorage:')) {
            errorMessage = 'Chaves devem estar entre aspas. Use "sessionStorage" ao invés de sessionStorage';
          }
        }
        
        diagnostics.push({
          from: Math.max(0, errorPosition - 1),
          to: Math.min(content.length, errorPosition + 10),
          severity: 'error',
          message: `❌ JSON inválido: ${errorMessage}`
        });
      }
      
      return diagnostics;
    });
  }

  // Format JSON in CodeMirror editor
  formatJsonInEditor(editorView) {
    try {
      const currentContent = editorView.state.doc.toString().trim();
      
      // Não formatar se estiver vazio
      if (!currentContent) return;
      
      // Tentar corrigir JSON comum com chaves sem aspas
      let correctedJson = currentContent;
      
      // Detectar e corrigir chaves sem aspas
      const needsCorrection = correctedJson.includes('cookies:') || 
                             correctedJson.includes('localStorage:') || 
                             correctedJson.includes('sessionStorage:');
      
      if (needsCorrection) {
        correctedJson = correctedJson
          .replace(/(\s*)cookies(\s*):/g, '$1"cookies"$2:')
          .replace(/(\s*)localStorage(\s*):/g, '$1"localStorage"$2:')
          .replace(/(\s*)sessionStorage(\s*):/g, '$1"sessionStorage"$2:');
      }
      
      // Tentar fazer parse e formatar
      const parsed = JSON.parse(correctedJson);
      const formatted = JSON.stringify(parsed, null, 2);
      
      // Só atualizar se o conteúdo mudou (evitar loops)
      if (formatted !== currentContent) {
        const transaction = editorView.state.update({
          changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: formatted
          }
        });
        
        editorView.dispatch(transaction);
        
        // Mostrar feedback visual se houve correção
        if (needsCorrection) {
          this.log('🔧 JSON formatado e corrigido automaticamente', 'success');
        }
      }
      
    } catch (error) {
      // Silenciosamente ignorar erros de formatação durante a digitação
      // O usuário verá o erro quando tentar usar o JSON
    }
  }

  // Initialize Single Editor
  initSingleEditor(containerId, editorKey, placeholder, readonly = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Limpar container
    container.innerHTML = '';
    
    // Configurar extensões base
    const extensions = [
      // Funcionalidades básicas
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),

      
      // Keymaps
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
      ]),
      
      // Linguagem e tema
      javascript({ typescript: true }),
      oneDark,
      
      // Configurações customizadas
      indentUnit.of('  '), // 2 espaços para indentação
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          fontSize: '12px',
          fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
        },
        '.cm-focused': {
          outline: 'none'
        },
        '.cm-editor': {
          borderRadius: '6px'
        },
        '.cm-scroller': {
          fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
        },
        '.cm-gutters': {
          paddingRight: '2px',
          marginRight: '2px'
        },
        '.cm-content': {
          padding: '16px 16px 16px 4px',
          minHeight: '120px'
        },
        // Estilo para editor readonly
        '&.cm-readonly .cm-cursor': {
          display: 'none'
        },
        '&.cm-readonly .cm-content': {
          cursor: 'default'
        }
      })
    ];

    // Adicionar listener de atualização para auto-save nos editores editáveis
    if (!readonly) {
      extensions.push(EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          // Apenas salva a configuração, não regenera o código para não sobrescrever
          // o que o usuário está digitando.
          this.saveConfig();
        }
      }));
    }

    // Adicionar extensão readonly se necessário
    if (readonly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    // Configurar estado inicial do editor
    const startState = EditorState.create({
      doc: placeholder,
      extensions: extensions
    });
    
    // Criar instância do editor
    this.editors[editorKey] = new EditorView({
      state: startState,
      parent: container
    });

    // Adicionar classe CSS para readonly
    if (readonly) {
      this.editors[editorKey].dom.classList.add('cm-readonly');
    }
  }

  // Display Generated Code Sections
  displayGeneratedCodeSections(codeSections) {
    if (!this.editors.header || !this.editors.automation || !this.editors.footer) return;
    
    // Atualizar conteúdo dos editores CodeMirror se a seção existir no objeto
    if (codeSections.header) {
      const headerTransaction = this.editors.header.state.update({
        changes: {
          from: 0,
          to: this.editors.header.state.doc.length,
          insert: codeSections.header
        }
      });
      this.editors.header.dispatch(headerTransaction);
    }

    if (codeSections.automation) {
      const automationTransaction = this.editors.automation.state.update({
        changes: {
          from: 0,
          to: this.editors.automation.state.doc.length,
          insert: codeSections.automation
        }
      });
      this.editors.automation.dispatch(automationTransaction);
    }

    if (codeSections.footer) {
      const footerTransaction = this.editors.footer.state.update({
        changes: {
          from: 0,
          to: this.editors.footer.state.doc.length,
          insert: codeSections.footer
        }
      });
      this.editors.footer.dispatch(footerTransaction);
    }
  }

  // Copy Generated Code
  async copyGeneratedCode() {
    const copyBtn = document.getElementById('copyCodeBtn');
    const originalHTML = copyBtn.innerHTML;
    
    if (!this.editors.header || !this.editors.automation || !this.editors.footer) {
      this.log('⚠️ Editores não inicializados', 'warning');
      return;
    }
    
    const headerCode = this.editors.header.state.doc.toString();
    const automationCode = this.editors.automation.state.doc.toString();
    const footerCode = this.editors.footer.state.doc.toString();
    
    const textToCopy = `${headerCode}\n\n${automationCode}\n\n${footerCode}`;
    
    if (!textToCopy.trim()) {
      this.log('⚠️ Nenhum código para copiar', 'warning');
      return;
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
        this.log('📋 Código completo copiado para clipboard!', 'success');
      } else {
        // Fallback para browsers mais antigos
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.log('📋 Código completo copiado para clipboard!', 'success');
      }
      
      // Alterar ícone e texto do botão para indicar sucesso
      copyBtn.innerHTML = '<i data-lucide="check"></i> Sucesso!';
      
      // Recriar ícones do Lucide após mudança do HTML
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
      
      // Restaurar texto original após 3 segundos
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }, 3000);
      
    } catch (error) {
      this.log(`❌ Erro ao copiar código: ${error.message}`, 'error');
    }
  }





  // Import/Export Configuration
  async exportConfig() {
    const exportBtn = document.getElementById('exportConfig');
    const originalHTML = exportBtn.innerHTML;
    
    try {
      const config = this.getConfigFromForm();
      const configJson = JSON.stringify(config, null, 2);
      
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(configJson);
        this.log('✅ Configurações exportadas para o clipboard!', 'success');
      } else {
        // Fallback para browsers mais antigos
        const textArea = document.createElement('textarea');
        textArea.value = configJson;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.log('✅ Configurações exportadas para o clipboard!', 'success');
      }
      
      // Alterar ícone e texto do botão para indicar sucesso
      exportBtn.innerHTML = '<i data-lucide="check"></i> Sucesso!';
      
      // Recriar ícones do Lucide após mudança do HTML
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
      
      // Restaurar texto original após 3 segundos
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }, 3000);
      
    } catch (error) {
      this.log(`❌ Erro ao exportar configurações: ${error.message}`, 'error');
    }
  }

  async importConfig() {
    const importBtn = document.getElementById('importConfig');
    const originalHTML = importBtn.innerHTML;
    
    try {
      let configText = '';
      
      if (navigator.clipboard) {
        configText = await navigator.clipboard.readText();
      } else {
        // Fallback para browsers mais antigos - solicitar que o usuário cole
        configText = prompt('Cole aqui o JSON das configurações:');
      }
      
      if (!configText || !configText.trim()) {
        this.log('⚠️ Clipboard vazio ou operação cancelada', 'warning');
        return;
      }
      
      // Validar e parsear JSON
      let config;
      try {
        config = JSON.parse(configText.trim());
      } catch (parseError) {
        this.log('❌ JSON inválido no clipboard. Verifique o formato.', 'error');
        return;
      }
      
      // Aplicar configurações ao formulário
      this.setConfigToForm(config);
      
      // Salvar configurações
      this.saveConfig();
      
      this.log('✅ Configurações importadas com sucesso!', 'success');
      
      // Alterar ícone e texto do botão para indicar sucesso
      importBtn.innerHTML = '<i data-lucide="check"></i> Sucesso!';
      
      // Recriar ícones do Lucide após mudança do HTML
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
      
      // Restaurar texto original após 3 segundos
      setTimeout(() => {
        importBtn.innerHTML = originalHTML;
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }, 3000);
      
      // Mostrar resumo das configurações importadas
      const configKeys = Object.keys(config);
      if (configKeys.length > 0) {
        this.log(`📋 Configurações carregadas: ${configKeys.join(', ')}`, 'info');
      }
      
    } catch (error) {
      this.log(`❌ Erro ao importar configurações: ${error.message}`, 'error');
    }
  }

  // Config Management
  getConfigFromForm() {
    const config = {};

    const slowMoEl = document.getElementById('slowMo');
    if (slowMoEl) {
      const slowMoValue = slowMoEl.value.trim();
      // Valor vazio ou "0" = sem slow motion
      const slowMo = slowMoValue === '' ? 0 : parseInt(slowMoValue);
      if (!isNaN(slowMo) && slowMo >= 0) config.slowMo = slowMo;
    }

    const timeoutEl = document.getElementById('timeout');
    if (timeoutEl) {
      const timeout = parseInt(timeoutEl.value);
      if (timeout > 0) config.timeout = timeout;
    }

    const userAgentEl = document.getElementById('userAgent');
    if (userAgentEl) {
      const userAgent = userAgentEl.value.trim();
      if (userAgent) config.userAgent = userAgent;
    }

    const browserWSEndpointEl = document.getElementById('browserWSEndpoint');
    if (browserWSEndpointEl) {
      const browserWSEndpoint = browserWSEndpointEl.value.trim();
      if (browserWSEndpoint) config.browserWSEndpoint = browserWSEndpoint;
    }

    const initialUrlEl = document.getElementById('initialUrl');
    if (initialUrlEl) {
      const initialUrl = initialUrlEl.value.trim();
      if (initialUrl) config.initialUrl = initialUrl;
    }

    // Obter sessionData do editor CodeMirror ou fallback para textarea
    let sessionDataValue = '';
    if (this.editors.sessionData) {
      sessionDataValue = this.editors.sessionData.state.doc.toString().trim();
    } else {
      const sessionDataEl = document.getElementById('sessionData');
      if (sessionDataEl) {
        sessionDataValue = sessionDataEl.value.trim();
      }
    }
    
    if (sessionDataValue) {
      try {
        // Tentar corrigir JSON comum com chaves sem aspas
        let correctedJson = sessionDataValue;
        
        // Detectar se há chaves sem aspas (padrão comum)
        if (correctedJson.includes('cookies:') || correctedJson.includes('localStorage:') || correctedJson.includes('sessionStorage:')) {
          // Corrigir chaves comuns sem aspas
          correctedJson = correctedJson
            .replace(/(\s*)cookies(\s*):/g, '$1"cookies"$2:')
            .replace(/(\s*)localStorage(\s*):/g, '$1"localStorage"$2:')
            .replace(/(\s*)sessionStorage(\s*):/g, '$1"sessionStorage"$2:');
          
          this.log('🔧 JSON corrigido automaticamente (adicionadas aspas nas chaves)', 'info');
        }
        
        const parsedSessionData = JSON.parse(correctedJson);
          
          // Verificar se é um objeto vazio {} - tratar como "limpar tudo"
          const keys = Object.keys(parsedSessionData);
          if (keys.length === 0) {
            console.log('🧹 Frontend detectou {} vazio - interpretando como limpar tudo');
            config.sessionData = {
              cookies: [],
              localStorage: {},
              sessionStorage: {}
            };
          } else {
            // Construir sessionData completo incluindo todas as propriedades definidas
            const sessionDataObj = {};
            
            // Incluir cookies no sessionData se definido
            if (parsedSessionData.cookies !== undefined) {
              sessionDataObj.cookies = parsedSessionData.cookies;
            }
            
            if (parsedSessionData.localStorage !== undefined) {
              sessionDataObj.localStorage = parsedSessionData.localStorage;
            }
            
            if (parsedSessionData.sessionStorage !== undefined) {
              sessionDataObj.sessionStorage = parsedSessionData.sessionStorage;
            }
            
            // SEMPRE aplicar sessionData quando qualquer propriedade estiver definida
            if (parsedSessionData.cookies !== undefined || 
                parsedSessionData.localStorage !== undefined || 
                parsedSessionData.sessionStorage !== undefined) {
              config.sessionData = sessionDataObj;
              
              // Log de debug para confirmar processamento
              console.log('✅ Session Data processado:', {
                cookies: sessionDataObj.cookies?.length || 0,
                localStorage: Object.keys(sessionDataObj.localStorage || {}).length,
                sessionStorage: Object.keys(sessionDataObj.sessionStorage || {}).length
              });
            }
          }
      } catch (error) {
        this.log(`❌ Erro no JSON do Session Data: ${error.message}`, 'error');
        this.log('💡 Dica: Verifique se as chaves estão entre aspas (ex: "cookies" ao invés de cookies)', 'warning');
        console.error('Session Data JSON Error:', error);
        console.log('Valor problemático:', sessionDataValue);
      }
    }

    // Salvar conteúdo dos editores de automação e footer
    if (this.editors.automation) {
      config.automationCode = this.editors.automation.state.doc.toString();
    }
    if (this.editors.footer) {
      config.footerCode = this.editors.footer.state.doc.toString();
    }

    // Campos opcionais que podem não existir no HTML atual
    const blockedResourcesTypesEl = document.getElementById('blockedResourcesTypes');
    if (blockedResourcesTypesEl) {
      const blockedResourcesTypes = blockedResourcesTypesEl.value.trim();
      if (blockedResourcesTypes) {
        config.blockedResourcesTypes = blockedResourcesTypes.split(',').map(s => s.trim());
      }
    }

    const waitUntilEl = document.getElementById('waitUntil');
    if (waitUntilEl) {
      const waitUntil = waitUntilEl.value;
      if (waitUntil !== 'domcontentloaded') {
        config.navigationOptions = { waitUntil };
      }
    }

    return config;
  }

  validateConfig(config) {
    if (config.initialUrl && !this.isValidUrl(config.initialUrl)) {
      this.log('URL inicial inválida', 'warning');
      return false;
    }

    return true;
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Templates
  getTemplates() {
    return {
      basic: {
        name: 'Configuração Básica',
        config: {
          slowMo: 0,
          timeout: 60,
          initialUrl: 'https://example.com'
        }
      },
      ecommerce: {
        name: '🛒 E-commerce',
        config: {
          slowMo: 0,
          timeout: 90,
          initialUrl: 'https://shopee.com.br',
          sessionData: {
            localStorage: {
              preferred_language: 'pt-BR',
              currency: 'BRL'
            }
          }
        }
      },
      social: {
        name: '📱 Social Media',
        config: {
          slowMo: 0,
          timeout: 120,
          initialUrl: 'https://twitter.com/login',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
          sessionData: {
            cookies: [
              {"name": "logged_in", "value": "yes", "domain": ".twitter.com"}
            ]
          }
        }
      },
      scraping: {
        name: '🔍 Web Scraping',
        config: {
          slowMo: 0,
          timeout: 45,
          blockedResourcesTypes: ['image', 'stylesheet', 'font'],
          navigationOptions: { waitUntil: 'networkidle0' }
        }
      }
    };
  }

  applyTemplate(templateName) {
    const template = this.templates[templateName];
    if (!template) return;

    this.log(`Aplicando template: ${template.name}`, 'info');
    this.setConfigToForm(template.config);
    
    // Gerar código automaticamente após aplicar template
    this.generateCodeAutomatically();
  }

  applySessionTemplate(templateName) {
    let sessionData = {};

    switch (templateName) {
      case 'clear-all':
        sessionData = {
          "cookies": [],
          "localStorage": {},
          "sessionStorage": {}
        };
        this.log('🧹 Aplicado template: Limpar Tudo', 'info');
        break;
        
      case 'clear-cookies':
        sessionData = {
          "cookies": []
        };
        this.log('🍪 Aplicado template: Limpar só Cookies', 'info');
        break;
        
      case 'clear-localStorage':
        sessionData = {
          "localStorage": {}
        };
        this.log('💾 Aplicado template: Limpar só localStorage', 'info');
        break;
        
      case 'clear-sessionStorage':
        sessionData = {
          "sessionStorage": {}
        };
        this.log('🔄 Aplicado template: Limpar só sessionStorage', 'info');
        break;
        
      case 'empty':
        sessionData = {};
        this.log('📋 Aplicado template: {} Vazio', 'info');
        break;
        
      default:
        return;
    }

    // Aplicar o JSON formatado ao editor CodeMirror ou textarea
    const jsonString = JSON.stringify(sessionData, null, 2);
    
    if (this.editors.sessionData) {
      const transaction = this.editors.sessionData.state.update({
        changes: {
          from: 0,
          to: this.editors.sessionData.state.doc.length,
          insert: jsonString
        }
      });
      this.editors.sessionData.dispatch(transaction);
    } else {
      // Fallback para textarea
      const sessionDataEl = document.getElementById('sessionData');
      if (sessionDataEl) {
        sessionDataEl.value = jsonString;
        // Trigger input event to save config
        sessionDataEl.dispatchEvent(new Event('input'));
      }
    }
    
    // Gerar código automaticamente após template
    this.generateCodeAutomatically();
  }

  applyUserAgentTemplate(templateName) {
    const userAgentEl = document.getElementById('userAgent');
    if (!userAgentEl) return;

    let userAgent = '';

    switch (templateName) {
      case 'chrome-desktop':
        userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.log('💻 Aplicado User Agent: Chrome Desktop', 'info');
        break;
        
      case 'safari-desktop':
        userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
        this.log('💻 Aplicado User Agent: Safari Desktop', 'info');
        break;
        
      case 'iphone':
        userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
        this.log('📱 Aplicado User Agent: iPhone', 'info');
        break;
        
      case 'android':
        userAgent = 'Mozilla/5.0 (Linux; Android 14; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
        this.log('📱 Aplicado User Agent: Android', 'info');
        break;
        
      case 'current-browser':
        userAgent = navigator.userAgent;
        this.log('🌐 Aplicado User Agent: Navegador Atual', 'info');
        break;
        
      case 'clear':
        userAgent = '';
        this.log('🧹 User Agent limpo', 'info');
        break;
        
      default:
        return;
    }

    // Aplicar o user agent ao campo
    userAgentEl.value = userAgent;
    
    // Trigger input event to save config
    userAgentEl.dispatchEvent(new Event('input'));
    
    // Gerar código automaticamente após template
    this.generateCodeAutomatically();
  }

  setConfigToForm(config) {
    console.log('🔧 setConfigToForm chamado com:', config);
    
    const slowMoEl = document.getElementById('slowMo');
    if (slowMoEl && config.slowMo !== undefined) {
      // Se slowMo é 0, pode mostrar como vazio (equivalente)
      slowMoEl.value = config.slowMo === 0 ? '' : config.slowMo;
    }
    
    const timeoutEl = document.getElementById('timeout');
    if (timeoutEl && config.timeout) timeoutEl.value = config.timeout;
    
    const userAgentEl = document.getElementById('userAgent');
    if (userAgentEl && config.userAgent) userAgentEl.value = config.userAgent;
    
    const browserWSEndpointEl = document.getElementById('browserWSEndpoint');
    if (browserWSEndpointEl && config.browserWSEndpoint) browserWSEndpointEl.value = config.browserWSEndpoint;
    
    const initialUrlEl = document.getElementById('initialUrl');
    if (initialUrlEl && config.initialUrl) initialUrlEl.value = config.initialUrl;

    // Construir o sessionData combinando cookies e sessionData
    const sessionDataObj = {};
    
    console.log('🔍 Config recebido - cookies:', config.cookies);
    console.log('🔍 Config recebido - sessionData:', config.sessionData);
    
    // Incluir cookies - verificar tanto config.cookies quanto config.sessionData.cookies
    if (config.cookies !== undefined) {
      sessionDataObj.cookies = config.cookies;
      console.log('✅ Cookies (direto) adicionados ao sessionDataObj');
    } else if (config.sessionData?.cookies !== undefined) {
      sessionDataObj.cookies = config.sessionData.cookies;
      console.log('✅ Cookies (sessionData) adicionados ao sessionDataObj');
    }
    
    if (config.sessionData?.localStorage !== undefined) {
      sessionDataObj.localStorage = config.sessionData.localStorage;
      console.log('✅ localStorage adicionado ao sessionDataObj');
    }
    
    if (config.sessionData?.sessionStorage !== undefined) {
      sessionDataObj.sessionStorage = config.sessionData.sessionStorage;
      console.log('✅ sessionStorage adicionado ao sessionDataObj');
    }
    
    // Atualizar sessionData usando o editor CodeMirror se disponível
    console.log('🔍 Verificando editor sessionData:', !!this.editors.sessionData);
    console.log('🔍 SessionData para carregar:', sessionDataObj);
    
    // Verificar se há dados para carregar (incluindo arrays/objetos vazios)
    const hasSessionData = Object.keys(sessionDataObj).length > 0;
    console.log('🔍 Tem dados para carregar:', hasSessionData);
    console.log('🔍 Chaves do sessionDataObj:', Object.keys(sessionDataObj));
    console.log('🔍 SessionDataObj completo:', sessionDataObj);
    
    if (this.editors.sessionData && hasSessionData) {
      const jsonString = JSON.stringify(sessionDataObj, null, 2);
      
      console.log('🔄 Carregando sessionData no editor CodeMirror:', jsonString);
      
      const transaction = this.editors.sessionData.state.update({
        changes: {
          from: 0,
          to: this.editors.sessionData.state.doc.length,
          insert: jsonString
        }
      });
      this.editors.sessionData.dispatch(transaction);
    } else {
      // Fallback para textarea se editor não estiver disponível
      console.log('⚠️ Editor não disponível, usando fallback para textarea');
      const sessionDataEl = document.getElementById('sessionData');
      if (sessionDataEl && hasSessionData) {
        const jsonString = JSON.stringify(sessionDataObj, null, 2);
        sessionDataEl.value = jsonString;
        console.log('🔄 SessionData carregado no textarea:', jsonString);
      } else if (!sessionDataEl) {
        console.log('❌ Textarea sessionData não encontrado');
      } else {
        console.log('ℹ️ Nenhum sessionData para carregar no textarea');
      }
    }

    // Carregar código personalizado dos editores, se existir (incluindo string vazia)
    if (this.editors.automation && config.automationCode !== undefined) {
      const automationTransaction = this.editors.automation.state.update({
        changes: {
          from: 0,
          to: this.editors.automation.state.doc.length,
          insert: config.automationCode
        }
      });
      this.editors.automation.dispatch(automationTransaction);
    }

    if (this.editors.footer && config.footerCode !== undefined) {
      const footerTransaction = this.editors.footer.state.update({
        changes: {
          from: 0,
          to: this.editors.footer.state.doc.length,
          insert: config.footerCode
        }
      });
      this.editors.footer.dispatch(footerTransaction);
    }

    // Campos opcionais que podem não existir
    const blockedResourcesTypesEl = document.getElementById('blockedResourcesTypes');
    if (blockedResourcesTypesEl && config.blockedResourcesTypes) {
      blockedResourcesTypesEl.value = config.blockedResourcesTypes.join(', ');
    }

    const waitUntilEl = document.getElementById('waitUntil');
    if (waitUntilEl && config.navigationOptions?.waitUntil) {
      waitUntilEl.value = config.navigationOptions.waitUntil;
    }

    this.saveConfig();
    
    // Gerar código automaticamente após carregar configuração
    this.generateCodeAutomatically();
  }

  // Documentation Modal
  async openDocumentation() {
    const modal = document.getElementById('docsModal');
    const content = document.getElementById('docsContent');
    
    if (!modal || !content) return;
    
    // Show modal
    modal.style.display = 'flex';
    
    // Reset content to loading state
    content.innerHTML = `
      <div class="loading-spinner">
        <i data-lucide="loader-2"></i>
        Carregando documentação...
      </div>
    `;
    
    // Reinitialize icons
    this.initializeIcons();
    
    try {
      // Fetch documentation
      const response = await fetch('/api/docs');
      const result = await response.json();
      
      if (response.ok) {
        content.innerHTML = result.content;
        
        // Apply special styling to sections based on content
        this.applyDocumentationStyling(content);
        
        this.log('📖 Documentação carregada com sucesso', 'info');
      } else {
        content.innerHTML = `
          <div class="error-message">
            <i data-lucide="alert-circle"></i>
            <h3>Erro ao carregar documentação</h3>
            <p>${result.error || 'Erro desconhecido'}</p>
          </div>
        `;
        this.log(`❌ Erro ao carregar documentação: ${result.error}`, 'error');
      }
    } catch (error) {
      content.innerHTML = `
        <div class="error-message">
          <i data-lucide="wifi-off"></i>
          <h3>Erro de conexão</h3>
          <p>Não foi possível conectar ao servidor para carregar a documentação.</p>
          <small>${error.message}</small>
        </div>
      `;
      this.log(`❌ Erro de conexão ao carregar documentação: ${error.message}`, 'error');
    }
    
    // Reinitialize icons after content update
    this.initializeIcons();
  }

  closeDocumentation() {
    const modal = document.getElementById('docsModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  applyDocumentationStyling(container) {
    // Style headers based on emojis
    const headers = container.querySelectorAll('h2, h3');
    headers.forEach(header => {
      const text = header.textContent || header.innerText;
      
      if (text.includes('⚠️') || text.includes('IMPORTANTE')) {
        header.classList.add('warning-section');
      } else if (text.includes('🚀')) {
        header.classList.add('info-section');
      } else if (text.includes('🔧') || text.includes('🛠️')) {
        header.classList.add('config-section');
      }
    });

    // Style code elements that contain flags
    const codeElements = container.querySelectorAll('code');
    codeElements.forEach(code => {
      const text = code.textContent || code.innerText;
      if (text.startsWith('--')) {
        code.classList.add('command-flag');
      }
    });

    // Improve lists with better spacing for nested content
    const listItems = container.querySelectorAll('li');
    listItems.forEach(li => {
      // Add class for items with code or special content
      if (li.querySelector('code') || li.textContent.includes('→')) {
        li.style.paddingTop = '6px';
        li.style.paddingBottom = '6px';
      }
    });

    // Add special styling to important paragraphs
    const paragraphs = container.querySelectorAll('p');
    paragraphs.forEach(p => {
      const text = p.textContent || p.innerText;
      if (text.includes('ESSENCIAL') || text.includes('IMPORTANTE') || 
          text.includes('⚠️') || text.includes('OBRIGATÓRIO')) {
        p.style.background = '#fff3cd';
        p.style.border = '1px solid #ffeaa7';
        p.style.borderRadius = '6px';
        p.style.padding = '10px 12px';
        p.style.margin = '12px 0';
        p.style.color = '#856404';
        p.style.fontWeight = '500';
      }
    });
  }

  // Advanced Config Toggle
  toggleAdvancedConfig() {
    const toggleBtn = document.getElementById('toggleAdvancedConfig');
    const content = document.getElementById('advancedConfigContent');
    const toggleIcon = toggleBtn.querySelector('.toggle-icon');
    
    if (!toggleBtn || !content || !toggleIcon) return;
    
    const isExpanded = !content.classList.contains('collapsed');
    
    if (isExpanded) {
      // Colapsar
      content.classList.add('collapsed');
      toggleBtn.classList.remove('expanded');
      toggleBtn.querySelector('.toggle-text').textContent = 'Mostrar Configurações';
    } else {
      // Expandir
      content.classList.remove('collapsed');
      toggleBtn.classList.add('expanded');
      toggleBtn.querySelector('.toggle-text').textContent = 'Ocultar Configurações';
    }
    
    // Salvar estado no localStorage
    this.saveAdvancedConfigState(!isExpanded);
    
    // Reinicializar ícones após mudança no DOM
    setTimeout(() => {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }, 100);
  }
  
  saveAdvancedConfigState(isExpanded) {
    localStorage.setItem('playground-advanced-config-expanded', JSON.stringify(isExpanded));
  }
  
  loadAdvancedConfigState() {
    try {
      const saved = localStorage.getItem('playground-advanced-config-expanded');
      const isExpanded = saved ? JSON.parse(saved) : false;
      
      const toggleBtn = document.getElementById('toggleAdvancedConfig');
      const content = document.getElementById('advancedConfigContent');
      
      if (!toggleBtn || !content) return;
      
      if (isExpanded) {
        content.classList.remove('collapsed');
        toggleBtn.classList.add('expanded');
        toggleBtn.querySelector('.toggle-text').textContent = 'Ocultar Configurações';
      } else {
        content.classList.add('collapsed');
        toggleBtn.classList.remove('expanded');
        toggleBtn.querySelector('.toggle-text').textContent = 'Mostrar Configurações';
      }
    } catch (error) {
      console.warn('Erro ao carregar estado das configurações avançadas:', error);
    }
  }

  // Config Persistence
  saveConfig() {
    // Evitar salvamento durante carregamento inicial
    if (this.isLoadingConfig) {
      console.log('⏸️ Salvamento ignorado durante carregamento');
      return;
    }
    
    const config = this.getConfigFromForm();
    console.log('💾 Salvando configuração:', config);
    localStorage.setItem('playground-config', JSON.stringify(config));
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem('playground-config');
      const parsed = saved ? JSON.parse(saved) : {};
      console.log('📖 Dados carregados do localStorage:', parsed);
      return parsed;
    } catch (error) {
      console.error('❌ Erro ao carregar config do localStorage:', error);
      return {};
    }
  }

  loadSavedConfig() {
    console.log('📂 Carregando configuração salva:', this.config);
    
    // Ativar flag para evitar loops de salvamento
    this.isLoadingConfig = true;
    
    if (Object.keys(this.config).length > 0) {
      this.setConfigToForm(this.config);
    } else {
      console.log('📂 Nenhuma configuração salva encontrada');
    }
    
    // Desativar flag após um pequeno delay
    setTimeout(() => {
      this.isLoadingConfig = false;
      console.log('✅ Carregamento de configuração concluído');
    }, 500);
    
    // Nota: Se não há config salva, os campos HTML já têm valores padrão
    // O código será gerado automaticamente no final do init()
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Aguardar um pouco para garantir que tudo carregou
  setTimeout(() => {
    window.playgroundApp = new PlaygroundApp();
  }, 100);
});