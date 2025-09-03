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
import ConfigService from './services/ConfigService.js';
import UIManager from './ui/UIManager.js';
import ApiService from './services/ApiService.js';
import EditorManager from './ui/EditorManager.js';
import ConstantsManager from './services/ConstantsManager.js';
import CodeProcessingService from './services/CodeProcessingService.js';

class PlaygroundApp {
  constructor() {
    this.ws = null;
    this.configService = new ConfigService(this);
    this.uiManager = new UIManager(this);
    this.apiService = new ApiService();
    this.editorManager = new EditorManager(this);
    this.constantsManager = new ConstantsManager(this);
    this.codeProcessingService = new CodeProcessingService(this.constantsManager);
    this.config = this.configService.loadConfig();
    this.templates = this.getTemplates();
    this.editors = this.editorManager.editors; // Shortcut
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
    this.editorManager.init();
    
    // Carregar configuração APÓS inicializar editores e constantes
    this.configService.loadSavedConfig();
    this.checkChromeStatus();
    this.initializeIcons();
    
    // Initialize results section with empty state
    this.uiManager.clearResultsContent();
    
    // Carregar estados das seções após DOM estar pronto
    setTimeout(() => {
      this.configService.loadAdvancedConfigState();
      this.configService.loadSectionStates();
      this.initializeIcons(); // Reinicializar ícones após mudanças
    }, 100);
    
    // Gerar código inicial após tudo estar configurado
    // Pequeno delay para garantir que todos os elementos estejam prontos
    setTimeout(() => {
      this.generateCodeAutomatically();
    }, 150);
  }
  
  initializeIcons() {
    // Aguardar Lucide estar disponível e inicializar ícones
    const initLucide = () => {
      if (typeof lucide !== 'undefined') {
        try {
          lucide.createIcons();
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
        this.uiManager.log('Conectado ao servidor', 'success');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Tratar mensagem de sessão expirada
          if (data.type === 'session_expired') {
            this.handleSessionExpired(data.sessionId);
          }
          
          this.uiManager.log(data.message, data.type);
        } catch (error) {
          this.uiManager.log(`${event.data}`, 'info');
        }
      };

      this.ws.onclose = () => {
        this.uiManager.log('Conexão perdida. Tentando reconectar...', 'warning');
        setTimeout(() => this.connectWebSocket(url), 3000);
      };

      this.ws.onerror = () => {
        this.uiManager.log('Erro na conexão WebSocket', 'error');
      };

    } catch (error) {
      this.uiManager.log(`Erro ao conectar: ${error.message}`, 'error');
    }
  }

  // Event Listeners
  setupEventListeners() {
    // Setup dropdown functionality
    this.setupDropdownListeners();
    
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
          
        case 'executeExtractionBtn':
          e.preventDefault();
          this.executeExtraction();
          break;
          
        case 'takeScreenshotBtn':
          e.preventDefault();
          this.takeScreenshot();
          break;

        case 'importConfig':
          e.preventDefault();
          this.importConfig();
          break;
          
        case 'importPuppeteerCookies':
          e.preventDefault();
          this.importPuppeteerCookies();
          break;
          
        case 'exportConfig':
          e.preventDefault();
          this.exportConfig();
          break;
          
        case 'docsBtn':
          e.preventDefault();
          this.uiManager.openDocumentation();
          break;
          
        case 'closeDocsModal':
          e.preventDefault();
          this.uiManager.closeDocumentation();
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
          this.uiManager.toggleAdvancedConfig();
          break;
          
        case 'toggleConfigSection':
          e.preventDefault();
          this.uiManager.toggleConfigSection();
          break;
          
        case 'toggleExecutionSection':
          e.preventDefault();
          this.uiManager.toggleExecutionSection();
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
        this.configService.saveConfig();
        // Gerar código automaticamente quando a configuração mudar
        this.generateCodeAutomatically();
      });
    });
  }

  setupModalEventListeners() {
    // Close modal when clicking on overlay
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.uiManager.closeDocumentation();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('docsModal');
        if (modal && modal.style.display !== 'none') {
          this.uiManager.closeDocumentation();
        }
      }
    });
  }

  // Chrome Status
  async checkChromeStatus() {
    this.uiManager.log('Verificando Chrome...', 'info');
    try {
      const result = await this.apiService.checkChromeStatus();
      const executeBtn = document.getElementById('executeBtn');
      if (executeBtn) executeBtn.disabled = false;
      this.uiManager.log('Chrome conectado e disponível', 'success');
    } catch (error) {
      const result = error.details || {};
      const executeBtn = document.getElementById('executeBtn');
      if (executeBtn) executeBtn.disabled = true;
      this.uiManager.log(error.message, 'warning');
      
      if (result.instructions) {
        this.uiManager.log(result.instructions, 'info');
      }
      if (result.testedEndpoints) {
        this.uiManager.log(`Endpoints testados: ${result.testedEndpoints.join(', ')}`, 'info');
      }
      if (result.troubleshooting) {
        this.uiManager.log('Troubleshooting:', 'info');
        result.troubleshooting.forEach(step => {
          this.uiManager.log(`   ${step}`, 'info');
        });
      }
    }
  }

  async validateWebSocketEndpoint() {
    const endpointInput = document.getElementById('browserWSEndpoint');
    const validateButton = document.getElementById('validateWSEndpoint');
    
    if (!endpointInput || !validateButton) return;
    
    const endpoint = endpointInput.value.trim();
    
    if (!endpoint) {
      this.uiManager.log('Por favor, insira uma URL WebSocket para validar', 'error');
      this.uiManager.showButtonError(validateButton, 'URL obrigatória', 'empty');
      return;
    }
    
    // Validar formato básico da URL
    if (!endpoint.startsWith('ws://') && !endpoint.startsWith('wss://')) {
      this.uiManager.log('URL deve começar com ws:// ou wss://', 'error');
      this.uiManager.showButtonError(validateButton, 'Formato inválido', 'format');
      return;
    }
    
    // Feedback visual no botão - estado de loading
    const originalContent = validateButton.innerHTML;
    validateButton.disabled = true;
    validateButton.classList.add('loading');
    validateButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 11-6.219-8.56"></path></svg><span>Validando...</span>';
    
    this.uiManager.log(`Validando conexão com ${endpoint}...`, 'info');
    
    let isSuccess = false;
    let errorType = 'connection';
    
    try {
      const data = await this.apiService.validateWebSocketEndpoint(endpoint);
      this.uiManager.log(`✅ Conexão válida! Chrome ${data.Browser || 'versão desconhecida'}`, 'success');
      this.uiManager.log(`WebSocket URL: ${data.webSocketDebuggerUrl || 'N/A'}`, 'info');
      isSuccess = true;
    } catch (error) {
      this.uiManager.log(`❌ Erro na validação: ${error.message}`, 'error');
      if (error.message.includes('Timeout')) {
        errorType = 'timeout';
      } else if (error.message.includes('HTTP')) {
        errorType = 'http';
      } else {
        this.uiManager.log('Verifique se o Chrome está rodando com --remote-debugging-port', 'info');
        errorType = 'connection';
      }
    } finally {
      validateButton.disabled = false;
      validateButton.classList.remove('loading');
      if (isSuccess) {
        this.uiManager.showButtonSuccess(validateButton, originalContent);
      } else {
        this.uiManager.showButtonError(validateButton, originalContent, errorType);
      }
    }
  }

  // Execute Session
  async executeSession() {
    const config = this.configService.getConfigFromForm();
    
    if (!this.configService.validateConfig(config)) {
      return;
    }

    // Processar código da sessão completa usando o novo serviço
    const codeBlocks = {
      header: this.editors.header?.state.doc.toString() || '',
      automation: this.editors.automation?.state.doc.toString() || '',
      footer: this.editors.footer?.state.doc.toString() || ''
    };
    
    const processingResult = this.codeProcessingService.processSessionCode(codeBlocks);
    
    if (!processingResult.isValid) {
      this.uiManager.log(`❌ ${processingResult.getErrorMessage()}`, 'error');
      return;
    }
    
    // Adicionar código processado à configuração
    config.customCode = processingResult.processedCode;
    
    // Log das constantes utilizadas
    if (processingResult.hasUsedConstants()) {
      this.uiManager.log(`🔑 Constantes utilizadas: ${processingResult.usedConstants.join(', ')}`, 'info');
    }

    this.uiManager.log('🚀 Executando sessão...', 'info');
    this.uiManager.setLoading(true);

    try {
      const result = await this.apiService.executeSession(config);
      this.uiManager.log(`${result.message}`, 'success');
      if (result.pageInfo) {
        this.uiManager.log(`${result.pageInfo.title} - ${result.pageInfo.url}`, 'info');
      }
    } catch (error) {
      this.uiManager.log(`${error.details.error || error.message}`, 'error');
    } finally {
      this.uiManager.setLoading(false);
    }
  }

  // Create new session
  async createSession() {
    const config = this.configService.getConfigFromForm();
    
    if (!this.configService.validateConfig(config)) {
      return;
    }

    this.uiManager.setLoading(true);

    try {
      const result = await this.apiService.createSession(config);
      this.currentSession = {
        id: result.sessionId,
        active: true,
        executionCount: 0,
        pageInfo: result.pageInfo
      };
      
      this.uiManager.updateSessionStatus();
      
      if (result.pageInfo) {
        this.uiManager.log(`📍 Página: ${result.pageInfo.title} - ${result.pageInfo.url}`, 'info');
      }
    } catch (error) {
      this.uiManager.log(`❌ Erro ao criar sessão: ${error.details.error || error.message}`, 'error');
    } finally {
      this.uiManager.setLoading(false);
    }
  }

  // Execute code in current session
  async executeCode() {
    if (!this.currentSession.active) {
      this.uiManager.log('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.', 'error');
      return;
    }

    // Get code from automation editor
    const code = this.editors.automation ? this.editors.automation.state.doc.toString() : '';
    
    // Processar código usando o novo serviço
    const processingResult = this.codeProcessingService.processCode(code, 'automation');
    
    if (!processingResult.isValid) {
      this.uiManager.log(`❌ ${processingResult.getErrorMessage()}`, 'error');
      return;
    }
    
    // Log das constantes utilizadas
    if (processingResult.hasUsedConstants()) {
      this.uiManager.log(`🔑 Constantes utilizadas: ${processingResult.usedConstants.join(', ')}`, 'info');
    }

    this.uiManager.setExecuteCodeLoading(true);

    try {
      const result = await this.apiService.executeCode(this.currentSession.id, processingResult.processedCode);
      this.currentSession.executionCount++;
      this.currentSession.pageInfo = result.pageInfo;
      
      this.uiManager.updateSessionStatus();
      
      // Show results section
      this.uiManager.showResults(result);
    } catch (error) {
      const details = error.details || {};
      if (details.sessionExpired) {
        this.handleSessionExpired(this.currentSession.id);
      }
      this.uiManager.log(`❌ Erro na execução: ${details.error || error.message}`, 'error');
    } finally {
      this.uiManager.setExecuteCodeLoading(false);
    }
  }

  // Execute extraction code only
  async executeExtraction() {
    if (!this.currentSession.active) {
      this.uiManager.log('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.', 'error');
      return;
    }

    // Get code from footer editor
    const footerCode = this.editors.footer ? this.editors.footer.state.doc.toString() : '';
    
    // Processar código usando o novo serviço
    const processingResult = this.codeProcessingService.processCode(footerCode, 'footer');
    
    if (!processingResult.isValid) {
      this.uiManager.log(`❌ ${processingResult.getErrorMessage()}`, 'error');
      return;
    }
    
    // Log das constantes utilizadas
    if (processingResult.hasUsedConstants()) {
      this.uiManager.log(`🔑 Constantes utilizadas na extração: ${processingResult.usedConstants.join(', ')}`, 'info');
    }

    this.uiManager.setExecuteExtractionLoading(true);

    try {
      const result = await this.apiService.executeCode(this.currentSession.id, processingResult.processedCode);
      
      if (result.result) {
        this.uiManager.log(`📋 Dados extraídos: ${JSON.stringify(result.result, null, 2)}`, 'info');
        
        // Exibir dados na aba "Dados" dos resultados
        this.uiManager.showExtractionData(result.result);
        this.uiManager.switchResultsTab('data');
      } else {
        this.uiManager.log('✅ Extração executada com sucesso (sem dados retornados)', 'success');
      }
      
      // Atualizar informações da página se disponível
      if (result.pageInfo) {
        this.currentSession.pageInfo = result.pageInfo;
        this.uiManager.updateSessionStatus();
      }
    } catch (error) {
      const details = error.details || {};
      if (details.sessionExpired) {
        this.handleSessionExpired(this.currentSession.id);
      }
      this.uiManager.log(`❌ Erro na extração: ${details.error || error.message}`, 'error');
    } finally {
      this.uiManager.setExecuteExtractionLoading(false);
    }
  }

  // Take screenshot of current session
  async takeScreenshot() {
    if (!this.currentSession.active) {
      this.uiManager.log('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.', 'error');
      return;
    }

    this.uiManager.log('📸 Capturando screenshot...', 'info');
    this.uiManager.setLoading(true);

    try {
      const result = await this.apiService.takeScreenshot(this.currentSession.id);
      this.uiManager.log(`✅ Screenshot capturado!`, 'success');
      this.uiManager.showScreenshot(result.screenshot);
    } catch (error) {
      const details = error.details || {};
      if (details.sessionExpired) {
        this.handleSessionExpired(this.currentSession.id);
      }
      this.uiManager.log(`❌ Erro ao capturar screenshot: ${details.error || error.message}`, 'error');
    } finally {
      this.uiManager.setLoading(false);
    }
  }

  // Close current session
  async closeSession() {
    if (!this.currentSession.active) {
      this.uiManager.log('❌ Nenhuma sessão ativa.', 'error');
      return;
    }

    this.uiManager.setLoading(true);

    try {
      // Executar código de extração de dados antes de fechar
      const footerCode = this.editors.footer?.state.doc.toString();
      
      // Verificar se há código de extração para executar
      if (this.codeProcessingService.hasExecutableContent(footerCode)) {
        this.uiManager.log('🔍 Executando extração de dados...', 'info');
        
        try {
          // Processar constantes no código de extração usando o novo serviço
          const processingResult = this.codeProcessingService.processCode(footerCode, 'footer');
          
          if (!processingResult.isValid) {
            this.uiManager.log(`⚠️ Erro no código de extração: ${processingResult.getErrorMessage()}`, 'warning');
          } else {
            // Log das constantes utilizadas na extração
            if (processingResult.hasUsedConstants()) {
              this.uiManager.log(`🔑 Constantes utilizadas na extração: ${processingResult.usedConstants.join(', ')}`, 'info');
            }
            
            // Executar código processado
            const executeResult = await this.apiService.executeCode(this.currentSession.id, processingResult.processedCode);
            
            if (executeResult.result) {
              this.uiManager.log(`📋 Dados extraídos: ${JSON.stringify(executeResult.result, null, 2)}`, 'info');
              
              // Exibir dados na aba "Dados" dos resultados
              this.uiManager.showExtractionData(executeResult.result);
              this.uiManager.switchResultsTab('data');
            }
          }
        } catch (extractError) {
          const details = extractError.details || {};
          this.uiManager.log(`⚠️ Erro na extração de dados: ${details.error || extractError.message}`, 'warning');
        }
      }

      // Fechar sessão
      try {
        const result = await this.apiService.closeSession(this.currentSession.id);
        this.currentSession = {
          id: null,
          active: false,
          executionCount: 0,
          pageInfo: null
        };
        
        this.uiManager.updateSessionStatus();
      } catch (error) {
        this.uiManager.log(`❌ Erro ao fechar sessão: ${error.details.error || error.message}`, 'error');
      }

    } finally {
      this.uiManager.setLoading(false);
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
      this.uiManager.updateSessionStatus();
      this.uiManager.hideResults();
      
      this.uiManager.log('🔄 Sessão resetada automaticamente devido à expiração.', 'warning');
    }
  }

  // Generate Code Automatically (local generation)
  generateCodeAutomatically(forceOverwrite = false) {
    // Não gerar código automaticamente se houver configuração salva para os editores
    const savedConfig = this.configService.loadConfig();
    
    if (savedConfig.automationCode !== undefined || savedConfig.footerCode !== undefined) {
      // Código personalizado encontrado, pular geração automática para automação/footer
    }

    const config = this.configService.getConfigFromForm();
    
    // Gerar código localmente sem requisição HTTP
    const codeSections = this.generateCodeSections(config);

    // Se houver código salvo (incluindo vazio), não sobrescrever, a menos que seja forçado
    if (savedConfig.automationCode !== undefined && !forceOverwrite) {
      delete codeSections.automation;
    }
    if (savedConfig.footerCode !== undefined && !forceOverwrite) {
      delete codeSections.footer;
    }

    this.editorManager.displayGeneratedCodeSections(codeSections);
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

  // Copy Generated Code
  async copyGeneratedCode() {
    const copyBtn = document.getElementById('copyCodeBtn');
    const originalHTML = copyBtn.innerHTML;
    
    if (!this.editors.header || !this.editors.automation || !this.editors.footer) {
      this.uiManager.log('⚠️ Editores não inicializados', 'warning');
      return;
    }
    
    const headerCode = this.editors.header.state.doc.toString();
    const automationCode = this.editors.automation.state.doc.toString();
    const footerCode = this.editors.footer.state.doc.toString();
    
    const textToCopy = `${headerCode}\n\n${automationCode}\n\n${footerCode}`;
    
    if (!textToCopy.trim()) {
      this.uiManager.log('⚠️ Nenhum código para copiar', 'warning');
      return;
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
        this.uiManager.log('📋 Código completo copiado para clipboard!', 'success');
      } else {
        // Fallback para browsers mais antigos
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.uiManager.log('📋 Código completo copiado para clipboard!', 'success');
      }
      
      this.uiManager.showTemporaryFeedback(copyBtn, 'Sucesso!', 'check');
      
    } catch (error) {
      this.uiManager.log(`❌ Erro ao copiar código: ${error.message}`, 'error');
    }
  }





  // Dropdown functionality
  setupDropdownListeners() {
    const dropdownBtn = document.getElementById('importDropdownBtn');
    const dropdownMenu = document.getElementById('importDropdownMenu');
    const dropdown = dropdownBtn?.closest('.dropdown');
    
    if (!dropdownBtn || !dropdownMenu || !dropdown) return;
    
    // Toggle dropdown on button click
    dropdownBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
    
    // Close dropdown when clicking on menu items (except submenu items)
    dropdownMenu.addEventListener('click', (e) => {
      // Não fechar se clicou no submenu ou em seus filhos
      if (e.target.closest('.dropdown-submenu-content') || e.target.closest('.dropdown-submenu')) {
        // Se clicou em um botão dentro do submenu, fechar o dropdown
        if (e.target.tagName === 'BUTTON') {
          dropdown.classList.remove('open');
        }
        return;
      }
      dropdown.classList.remove('open');
    });
  }

  // Import/Export Configuration
  async exportConfig() {
    const exportBtn = document.getElementById('exportConfig');
    const originalHTML = exportBtn.innerHTML;
    
    try {
      const config = this.configService.getConfigFromForm();
      const configJson = JSON.stringify(config, null, 2);
      
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(configJson);
        this.uiManager.log('✅ Configurações exportadas para o clipboard!', 'success');
      } else {
        // Fallback para browsers mais antigos
        const textArea = document.createElement('textarea');
        textArea.value = configJson;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.uiManager.log('✅ Configurações exportadas para o clipboard!', 'success');
      }

      this.uiManager.showTemporaryFeedback(exportBtn, 'Sucesso!', 'check');
      
    } catch (error) {
      this.uiManager.log(`❌ Erro ao exportar configurações: ${error.message}`, 'error');
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
        this.uiManager.log('⚠️ Clipboard vazio ou operação cancelada', 'warning');
        return;
      }
      
      // Validar e parsear JSON
      let config;
      try {
        config = JSON.parse(configText.trim());
      } catch (parseError) {
        this.uiManager.log('❌ JSON inválido no clipboard. Verifique o formato.', 'error');
        return;
      }
      
      // Aplicar configurações ao formulário
      this.configService.setConfigToForm(config);
      
      // Salvar configurações
      this.configService.saveConfig();
      
      this.uiManager.log('✅ Configurações importadas com sucesso!', 'success');
      this.uiManager.showTemporaryFeedback(importBtn, 'Sucesso!', 'check');
      
      // Mostrar resumo das configurações importadas
      const configKeys = Object.keys(config);
      if (configKeys.length > 0) {
        this.uiManager.log(`📋 Configurações carregadas: ${configKeys.join(', ')}`, 'info');
      }
      
    } catch (error) {
      this.uiManager.log(`❌ Erro ao importar configurações: ${error.message}`, 'error');
    }
  }

  async importPuppeteerCookies() {
    const importBtn = document.getElementById('importPuppeteerCookies');
    const originalHTML = importBtn.innerHTML;
    
    try {
      let cookiesText = '';
      
      if (navigator.clipboard) {
        cookiesText = await navigator.clipboard.readText();
      } else {
        // Fallback para browsers mais antigos - solicitar que o usuário cole
        cookiesText = prompt('Cole aqui o array de cookies do Puppeteer:');
      }
      
      if (!cookiesText || !cookiesText.trim()) {
        this.uiManager.log('⚠️ Clipboard vazio ou operação cancelada', 'warning');
        return;
      }
      
      // Validar e parsear JSON dos cookies
      let cookies;
      try {
        cookies = JSON.parse(cookiesText.trim());
      } catch (parseError) {
        this.uiManager.log('❌ JSON inválido no clipboard. Verifique o formato dos cookies.', 'error');
        return;
      }
      
      // Validar se é um array de cookies válido
      if (!Array.isArray(cookies)) {
        this.uiManager.log('❌ O formato deve ser um array de cookies do Puppeteer.', 'error');
        return;
      }
      
      // Validar estrutura básica dos cookies
      const isValidCookieArray = cookies.every(cookie => 
        typeof cookie === 'object' && 
        cookie.name && 
        cookie.value !== undefined
      );
      
      if (!isValidCookieArray) {
        this.uiManager.log('❌ Formato de cookies inválido. Cada cookie deve ter pelo menos "name" e "value".', 'error');
        return;
      }
      
      // Converter cookies do Puppeteer para o formato do playground
      const sessionData = {
        cookies: cookies
      };
      
      // Aplicar apenas os cookies ao editor de dados de sessão
      if (this.editors.sessionData) {
        const currentSessionData = this.editors.sessionData.state.doc.toString();
        let currentData = {};
        
        try {
          if (currentSessionData.trim()) {
            currentData = JSON.parse(currentSessionData);
          }
        } catch (e) {
          // Se não conseguir parsear, começar com objeto vazio
        }
        
        // Mesclar cookies com dados existentes
        const mergedData = {
          ...currentData,
          cookies: sessionData.cookies
        };
        
        // Atualizar editor
        this.editors.sessionData.dispatch({
          changes: {
            from: 0,
            to: this.editors.sessionData.state.doc.length,
            insert: JSON.stringify(mergedData, null, 2)
          }
        });
      }
      
      this.uiManager.log(`✅ ${cookies.length} cookies importados com sucesso!`, 'success');
      this.uiManager.showTemporaryFeedback(importBtn, 'Sucesso!', 'check');
      
      // Salvar configurações
      this.configService.saveConfig();
      
    } catch (error) {
      this.uiManager.log(`❌ Erro ao importar cookies: ${error.message}`, 'error');
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
          initialUrl: 'https://example.com',
          constants: {
            baseUrl: 'https://example.com',
            timeout: '5000'
          },
          automationCode: `// Exemplo usando constantes
await page.goto('{{ $baseUrl }}');
await page.waitForTimeout({{ $timeout }});

// Capturar título da página
const title = await page.title();
console.log('Título:', title);`
        }
      },
      ecommerce: {
        name: '🛒 E-commerce',
        config: {
          slowMo: 0,
          timeout: 90,
          initialUrl: 'https://shopee.com.br',
          constants: {
            searchTerm: 'smartphone',
            maxPrice: '1000',
            category: 'eletrônicos'
          },
          sessionData: {
            localStorage: {
              preferred_language: 'pt-BR',
              currency: 'BRL'
            }
          },
          automationCode: `// Buscar produtos usando constantes
await page.type('#search-input', '{{ $searchTerm }}');
await page.click('#search-button');

// Filtrar por preço máximo
await page.type('#max-price', '{{ $maxPrice }}');

// Aguardar resultados
await page.waitForSelector('.product-item');

// Capturar produtos encontrados
const products = await page.$$eval('.product-item', items => 
  items.map(item => ({
    name: item.querySelector('.product-name')?.textContent,
    price: item.querySelector('.product-price')?.textContent
  }))
);

console.log('Produtos encontrados:', products.length);`
        }
      },
      social: {
        name: '📱 Social Media',
        config: {
          slowMo: 0,
          timeout: 120,
          initialUrl: 'https://twitter.com/login',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
          constants: {
            username: 'seu_usuario',
            password: 'sua_senha',
            tweetText: 'Olá mundo! 🚀'
          },
          sessionData: {
            cookies: [
              {"name": "logged_in", "value": "yes", "domain": ".twitter.com"}
            ]
          },
          automationCode: `// Login usando constantes
await page.type('[name="session[username_or_email]"]', '{{ $username }}');
await page.type('[name="session[password]"]', '{{ $password }}');
await page.click('[data-testid="LoginForm_Login_Button"]');

// Aguardar login
await page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]');

// Criar novo tweet
await page.click('[data-testid="SideNav_NewTweet_Button"]');
await page.type('[data-testid="tweetTextarea_0"]', '{{ $tweetText }}');

console.log('Tweet preparado:', '{{ $tweetText }}');`
        }
      },
      scraping: {
        name: '🔍 Web Scraping',
        config: {
          slowMo: 0,
          timeout: 45,
          blockedResourcesTypes: ['image', 'stylesheet', 'font'],
          navigationOptions: { waitUntil: 'networkidle0' },
          constants: {
            targetUrl: 'https://quotes.toscrape.com',
            maxPages: '3',
            selector: '.quote'
          },
          automationCode: `// Scraping usando constantes
await page.goto('{{ $targetUrl }}');

const quotes = [];
let currentPage = 1;
const maxPages = parseInt('{{ $maxPages }}');

while (currentPage <= maxPages) {
  console.log(\`Processando página \${currentPage}...\`);
  
  // Extrair quotes da página atual
  const pageQuotes = await page.$$eval('{{ $selector }}', elements =>
    elements.map(el => ({
      text: el.querySelector('.text')?.textContent,
      author: el.querySelector('.author')?.textContent,
      tags: Array.from(el.querySelectorAll('.tag')).map(tag => tag.textContent)
    }))
  );
  
  quotes.push(...pageQuotes);
  
  // Tentar ir para próxima página
  const nextButton = await page.$('.next > a');
  if (nextButton && currentPage < maxPages) {
    await nextButton.click();
    await page.waitForSelector('{{ $selector }}');
    currentPage++;
  } else {
    break;
  }
}

console.log(\`Total de quotes coletadas: \${quotes.length}\`);`
        }
      }
    };
  }

  applyTemplate(templateName) {
    const template = this.templates[templateName];
    if (!template) {
      return;
    }

    this.uiManager.log(`Aplicando template: ${template.name}`, 'info');
    
    // Aplicar configuração do template e forçar a sobrescrita dos editores
    this.configService.setConfigToForm(template.config, true);
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
        this.uiManager.log('🧹 Aplicado template: Limpar Tudo', 'info');
        break;
        
      case 'clear-cookies':
        sessionData = {
          "cookies": []
        };
        this.uiManager.log('🍪 Aplicado template: Limpar só Cookies', 'info');
        break;
        
      case 'clear-localStorage':
        sessionData = {
          "localStorage": {}
        };
        this.uiManager.log('💾 Aplicado template: Limpar só localStorage', 'info');
        break;
        
      case 'clear-sessionStorage':
        sessionData = {
          "sessionStorage": {}
        };
        this.uiManager.log('🔄 Aplicado template: Limpar só sessionStorage', 'info');
        break;
        
      case 'empty':
        sessionData = {};
        this.uiManager.log('📋 Aplicado template: {} Vazio', 'info');
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
    
    // Gerar código automaticamente após carregar configuração
    this.generateCodeAutomatically(true);
  }

  applyUserAgentTemplate(templateName) {
    const userAgentEl = document.getElementById('userAgent');
    if (!userAgentEl) return;

    let userAgent = '';

    switch (templateName) {
      case 'chrome-desktop':
        userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.uiManager.log('💻 Aplicado User Agent: Chrome Desktop', 'info');
        break;
        
      case 'safari-desktop':
        userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
        this.uiManager.log('💻 Aplicado User Agent: Safari Desktop', 'info');
        break;
        
      case 'iphone':
        userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
        this.uiManager.log('📱 Aplicado User Agent: iPhone', 'info');
        break;
        
      case 'android':
        userAgent = 'Mozilla/5.0 (Linux; Android 14; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
        this.uiManager.log('📱 Aplicado User Agent: Android', 'info');
        break;
        
      case 'current-browser':
        userAgent = navigator.userAgent;
        this.uiManager.log('🌐 Aplicado User Agent: Navegador Atual', 'info');
        break;
        
      case 'clear':
        userAgent = '';
        this.uiManager.log('🧹 User Agent limpo', 'info');
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
        
        this.uiManager.log('📖 Documentação carregada com sucesso', 'info');
      } else {
        content.innerHTML = `
          <div class="error-message">
            <i data-lucide="alert-circle"></i>
            <h3>Erro ao carregar documentação</h3>
            <p>${result.error || 'Erro desconhecido'}</p>
          </div>
        `;
        this.uiManager.log(`❌ Erro ao carregar documentação: ${result.error}`, 'error');
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
      this.uiManager.log(`❌ Erro de conexão ao carregar documentação: ${error.message}`, 'error');
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
    this.configService.saveAdvancedConfigState(!isExpanded);
    
    // Reinicializar ícones após mudança no DOM
    setTimeout(() => {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }, 100);
  }
  
  // Config Persistence
  saveConfig() {
    // Evitar salvamento durante carregamento inicial
    if (this.isLoadingConfig) {
      return;
    }
    
    const config = this.configService.getConfigFromForm();
    localStorage.setItem('playground-config', JSON.stringify(config));
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem('playground-config');
      const parsed = saved ? JSON.parse(saved) : {};
      return parsed;
    } catch (error) {
      console.error('❌ Erro ao carregar config do localStorage:', error);
      return {};
    }
  }

  loadSavedConfig() {
    // Ativar flag para evitar loops de salvamento
    this.isLoadingConfig = true;
    
    if (Object.keys(this.config).length > 0) {
      this.configService.setConfigToForm(this.config);
    } else {
      console.log('📂 Nenhuma configuração salva encontrada');
    }
    
    // Desativar flag após um pequeno delay
    setTimeout(() => {
      this.isLoadingConfig = false;
    }, 500);
    
    // Nota: Se não há config salva, os campos HTML já têm valores padrão
    // O código será gerado automaticamente no final do init()
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
        
        this.uiManager.log('📖 Documentação carregada com sucesso', 'info');
      } else {
        content.innerHTML = `
          <div class="error-message">
            <i data-lucide="alert-circle"></i>
            <h3>Erro ao carregar documentação</h3>
            <p>${result.error || 'Erro desconhecido'}</p>
          </div>
        `;
        this.uiManager.log(`❌ Erro ao carregar documentação: ${result.error}`, 'error');
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
      this.uiManager.log(`❌ Erro de conexão ao carregar documentação: ${error.message}`, 'error');
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
    this.configService.saveAdvancedConfigState(!isExpanded);
    
    // Reinicializar ícones após mudança no DOM
    setTimeout(() => {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }, 100);
  }
  
  // Config Persistence
  saveConfig() {
    // Evitar salvamento durante carregamento inicial
    if (this.isLoadingConfig) {
      return;
    }
    
    const config = this.configService.getConfigFromForm();
    localStorage.setItem('playground-config', JSON.stringify(config));
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem('playground-config');
      const parsed = saved ? JSON.parse(saved) : {};
      return parsed;
    } catch (error) {
      console.error('❌ Erro ao carregar config do localStorage:', error);
      return {};
    }
  }

  loadSavedConfig() {
    // Ativar flag para evitar loops de salvamento
    this.isLoadingConfig = true;
    
    if (Object.keys(this.config).length > 0) {
      this.configService.setConfigToForm(this.config);
    } else {
      console.log('📂 Nenhuma configuração salva encontrada');
    }
    
    // Desativar flag após um pequeno delay
    setTimeout(() => {
      this.isLoadingConfig = false;
    }, 500);
    
    // Nota: Se não há config salva, os campos HTML já têm valores padrão
    // O código será gerado automaticamente no final do init()
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Aguardar um pouco para garantir que tudo carregou
  setTimeout(() => {
    window.app = new PlaygroundApp();
    window.playgroundApp = window.app; // Manter compatibilidade
  }, 100);
});