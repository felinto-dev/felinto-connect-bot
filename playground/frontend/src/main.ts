import './style.css';
import ConfigService from './services/ConfigService';
import UIManager from './ui/UIManager';
import ApiService from './services/ApiService';
import EditorManager from './ui/EditorManager';
import ConstantsManager from './services/ConstantsManager';
import CodeProcessingService from './services/CodeProcessingService';
import { AppConfig, SessionData } from './types/config';
import { AppEditors } from './types/editor';
import { PageInfo } from './types/api';

// Adicionar a propriedade 'app' à interface Window
declare global {
  interface Window {
    app: PlaygroundApp;
    playgroundApp: PlaygroundApp;
  }
}

interface CurrentSession {
  id: string | null;
  active: boolean;
  executionCount: number;
  pageInfo: PageInfo | null;
}

interface ExtractionData {
  hasData: boolean;
  timestamp: Date | null;
  data: any;
}

class PlaygroundApp {
  public ws: WebSocket | null;
  public configService: ConfigService;
  public uiManager: UIManager;
  public apiService: ApiService;
  public editorManager: EditorManager;
  public constantsManager: ConstantsManager;
  public codeProcessingService: CodeProcessingService;
  public config: AppConfig;
  public templates: Record<string, any>;
  public editors: AppEditors;
  public currentSession: CurrentSession;
  public extractionData: ExtractionData;
  public isLoadingConfig: boolean;

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
    this.editors = this.editorManager.editors;
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
    this.isLoadingConfig = false;
    
    this.init();
  }

  init(): void {
    this.setupWebSocket();
    this.setupEventListeners();
    this.setupPageNavigation();
    this.editorManager.init();
    
    this.configService.loadSavedConfig();
    this.checkChromeStatus();
    this.initializeIcons();
    
    this.uiManager.clearResultsContent();
    
    setTimeout(() => {
      this.configService.loadAdvancedConfigState();
      this.configService.loadSectionStates();
      this.initializeIcons();
    }, 100);
    
    setTimeout(() => {
      this.generateCodeAutomatically();
    }, 150);
  }
  
  initializeIcons(): void {
    const initLucide = () => {
      if (typeof window.lucide !== 'undefined') {
        try {
          window.lucide.createIcons();
        } catch (error) {
          console.error('Erro ao inicializar ícones Lucide:', error);
        }
      } else {
        setTimeout(initLucide, 100);
      }
    };
    initLucide();
  }

  setupWebSocket(): void {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:3001/ws`;
    this.connectWebSocket(wsUrl);
  }

  connectWebSocket(url: string): void {
    try {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => this.uiManager.log('Conectado ao servidor', 'success');

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'session_expired') {
            this.handleSessionExpired(data.sessionId);
          }
          this.uiManager.log(data.message, data.type);
        } catch (error) {
          this.uiManager.log(String(event.data), 'info');
        }
      };

      this.ws.onclose = () => {
        this.uiManager.log('Conexão perdida. Tentando reconectar...', 'warning');
        setTimeout(() => this.connectWebSocket(url), 3000);
      };

      this.ws.onerror = () => this.uiManager.log('Erro na conexão WebSocket', 'error');

    } catch (error) {
      if (error instanceof Error) {
        this.uiManager.log(`Erro ao conectar: ${error.message}`, 'error');
      }
    }
  }

  setupEventListeners(): void {
    this.setupDropdownListeners();
    this.setupNavigationListeners();
    
    document.body.addEventListener('click', (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('button');
      if (!target) return;
      
      const action = this.getButtonAction(target.id);
      if (action) {
        e.preventDefault();
        action();
      }
    });

    document.querySelectorAll<HTMLButtonElement>('.template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.applyTemplate(btn.dataset.template!);
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.session-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.applySessionTemplate(btn.dataset.sessionTemplate!);
      });
    });

    document.getElementById('useCurrentUserAgent')?.addEventListener('click', () => this.useCurrentUserAgent());
    document.getElementById('clearUserAgent')?.addEventListener('click', () => this.clearUserAgent());
    
    document.addEventListener('click', (e: MouseEvent) => {
      const presetBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('.preset-btn');
      if (presetBtn) {
        this.applyResourcePreset(presetBtn.dataset.preset!);
      }
    });

    document.addEventListener('change', (e: Event) => {
      if ((e.target as HTMLElement).matches('input[data-resource]')) {
        this.updateBlockedResourcesFromCheckboxes();
      }
    });

    document.getElementById('blockedResourcesTypes')?.addEventListener('input', () => this.updateBlockedResourcesFromAdvanced());

    document.addEventListener('click', (e: MouseEvent) => {
        const tabBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab-btn');
        if (tabBtn) {
            this.uiManager.switchResultsTab(tabBtn.dataset.tab as any);
        }
    });

    this.setupAutoSave();
    this.setupModalEventListeners();
  }

  private getButtonAction(id: string): (() => void) | null {
    const actions: Record<string, () => void> = {
      'sessionToggleBtn': () => this.toggleSession(),
      'executeCodeBtn': () => this.executeCode(),
      'executeExtractionBtn': () => this.executeExtraction(),
      'takeScreenshotBtn': () => this.takeScreenshot(),
      'importConfig': () => this.importConfig(),
      'importPuppeteerCookies': () => this.importPuppeteerCookies(),
      'exportConfig': () => this.exportConfig(),
      'docsBtn': () => this.uiManager.openDocumentation(),
      'closeDocsModal': () => this.uiManager.closeDocumentation(),
      'copyCodeBtn': () => this.copyGeneratedCode(),
      'validateWSEndpoint': () => this.validateWebSocketEndpoint(),
      'toggleAdvancedConfig': () => this.uiManager.toggleAdvancedConfig(),
      'toggleConfigSection': () => this.uiManager.toggleConfigSection(),
      'toggleExecutionSection': () => this.uiManager.toggleExecutionSection(),
    };
    return actions[id] || null;
  }

  setupAutoSave(): void {
    document.querySelectorAll('input, textarea, select').forEach(input => {
      input.addEventListener('input', () => {
        this.configService.saveConfig();
        this.generateCodeAutomatically();
      });
    });
  }

  setupModalEventListeners(): void {
    document.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
        this.uiManager.closeDocumentation();
      }
    });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('docsModal');
        if (modal && modal.style.display !== 'none') {
          this.uiManager.closeDocumentation();
        }
      }
    });
  }

  async checkChromeStatus(): Promise<void> {
    this.uiManager.log('Verificando Chrome...', 'info');
    try {
      await this.apiService.checkChromeStatus();
      const executeBtn = document.getElementById('executeBtn') as HTMLButtonElement | null;
      if (executeBtn) executeBtn.disabled = false;
      this.uiManager.log('Chrome conectado e disponível', 'success');
    } catch (error: any) {
      const executeBtn = document.getElementById('executeBtn') as HTMLButtonElement | null;
      if (executeBtn) executeBtn.disabled = true;
      this.uiManager.log(error.message, 'warning');
    }
  }

  async validateWebSocketEndpoint(): Promise<void> {
    const endpointInput = document.getElementById('browserWSEndpoint') as HTMLInputElement;
    const validateButton = document.getElementById('validateWSEndpoint') as HTMLButtonElement;
    
    if (!endpointInput || !validateButton) return;
    
    const endpoint = endpointInput.value.trim();
    if (!endpoint) {
      this.uiManager.log('Por favor, insira uma URL WebSocket para validar', 'error');
      return;
    }
    
    if (!endpoint.startsWith('ws://') && !endpoint.startsWith('wss://')) {
      this.uiManager.log('URL deve começar com ws:// ou wss://', 'error');
      return;
    }
    
    const originalContent = validateButton.innerHTML;
    validateButton.disabled = true;
    validateButton.classList.add('loading');
    validateButton.innerHTML = `<span>Validando...</span>`;
    
    this.uiManager.log(`Validando conexão com ${endpoint}...`, 'info');
    
    try {
      const data = await this.apiService.validateWebSocketEndpoint(endpoint);
      this.uiManager.log(`✅ Conexão válida! Chrome ${data.Browser || 'versão desconhecida'}`, 'success');
      this.uiManager.showButtonSuccess(validateButton, originalContent);
    } catch (error: any) {
      this.uiManager.log(`❌ Erro na validação: ${error.message}`, 'error');
      this.uiManager.showButtonError(validateButton, originalContent, 'connection');
    } finally {
      validateButton.disabled = false;
      validateButton.classList.remove('loading');
    }
  }

  async executeSession(): Promise<void> {
    const config = this.configService.getConfigFromForm();
    if (!this.configService.validateConfig(config)) return;

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
    
    // config.customCode = processingResult.processedCode; // Assuming customCode exists on AppConfig
    
    if (processingResult.hasUsedConstants()) {
      this.uiManager.log(`🔑 Constantes utilizadas: ${processingResult.usedConstants.join(', ')}`, 'info');
    }

    this.uiManager.log('🚀 Executando sessão...', 'info');
    this.uiManager.setLoading(true);

    try {
      const result = await this.apiService.executeSession(config);
      this.uiManager.log(result.message, 'success');
      if (result.pageInfo) {
        this.uiManager.log(`${result.pageInfo.title} - ${result.pageInfo.url}`, 'info');
      }
    } catch (error: any) {
      this.uiManager.log(error.details?.error || error.message, 'error');
    } finally {
      this.uiManager.setLoading(false);
    }
  }

  async createSession(): Promise<void> {
    const config = this.configService.getConfigFromForm();
    if (!this.configService.validateConfig(config)) return;

    this.uiManager.setSessionLoading(true);

    try {
      const result = await this.apiService.createSession(config);
      this.currentSession = {
        id: result.sessionId,
        active: true,
        executionCount: 0,
        pageInfo: result.pageInfo || null
      };
      
      this.uiManager.updateSessionStatus();
      
      if (result.pageInfo) {
        this.uiManager.log(`📍 Página: ${result.pageInfo.title} - ${result.pageInfo.url}`, 'info');
      }
    } catch (error: any) {
      this.uiManager.log(`❌ Erro ao criar sessão: ${error.details?.error || error.message}`, 'error');
    } finally {
      this.uiManager.setSessionLoading(false);
    }
  }

  async executeCode(): Promise<void> {
    if (!this.currentSession.active || !this.currentSession.id) {
      this.uiManager.log('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.', 'error');
      return;
    }

    const code = this.editors.automation ? this.editors.automation.state.doc.toString() : '';
    const processingResult = this.codeProcessingService.processCode(code, 'automation');
    
    if (!processingResult.isValid) {
      this.uiManager.log(`❌ ${processingResult.getErrorMessage()}`, 'error');
      return;
    }
    
    if (processingResult.hasUsedConstants()) {
      this.uiManager.log(`🔑 Constantes utilizadas: ${processingResult.usedConstants.join(', ')}`, 'info');
    }

    this.uiManager.setExecuteCodeLoading(true);

    try {
      const result = await this.apiService.executeCode(this.currentSession.id, processingResult.processedCode);
      this.currentSession.executionCount++;
      this.currentSession.pageInfo = result.pageInfo || null;
      
      this.uiManager.updateSessionStatus();
      this.uiManager.showResults(result);

    } catch (error: any) {
      if (error.details?.sessionExpired) {
        this.handleSessionExpired(this.currentSession.id);
      }
      this.uiManager.log(`❌ Erro na execução: ${error.details?.error || error.message}`, 'error');
    } finally {
      this.uiManager.setExecuteCodeLoading(false);
    }
  }

  async executeExtraction(): Promise<void> {
    if (!this.currentSession.active || !this.currentSession.id) {
      this.uiManager.log('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.', 'error');
      return;
    }

    const footerCode = this.editors.footer ? this.editors.footer.state.doc.toString() : '';
    const processingResult = this.codeProcessingService.processCode(footerCode, 'footer');
    
    if (!processingResult.isValid) {
      this.uiManager.log(`❌ ${processingResult.getErrorMessage()}`, 'error');
      return;
    }
    
    if (processingResult.hasUsedConstants()) {
      this.uiManager.log(`🔑 Constantes utilizadas na extração: ${processingResult.usedConstants.join(', ')}`, 'info');
    }

    this.uiManager.setExecuteExtractionLoading(true);

    try {
      const result = await this.apiService.executeCode(this.currentSession.id, processingResult.processedCode);
      
      if (result.result) {
        this.uiManager.log(`📋 Dados extraídos: ${JSON.stringify(result.result, null, 2)}`, 'info');
        this.uiManager.showExtractionData(result.result);
        this.uiManager.switchResultsTab('data');
      } else {
        this.uiManager.log('✅ Extração executada com sucesso (sem dados retornados)', 'success');
      }
      
      if (result.pageInfo) {
        this.currentSession.pageInfo = result.pageInfo;
        this.uiManager.updateSessionStatus();
      }
    } catch (error: any) {
      if (error.details?.sessionExpired) {
        this.handleSessionExpired(this.currentSession.id);
      }
      this.uiManager.log(`❌ Erro na extração: ${error.details?.error || error.message}`, 'error');
    } finally {
      this.uiManager.setExecuteExtractionLoading(false);
    }
  }

  async takeScreenshot(): Promise<void> {
    if (!this.currentSession.active || !this.currentSession.id) {
      this.uiManager.log('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.', 'error');
      return;
    }

    this.uiManager.log('📸 Capturando screenshot...', 'info');
    this.uiManager.setLoading(true);

    try {
      const result = await this.apiService.takeScreenshot(this.currentSession.id);
      this.uiManager.log(`✅ Screenshot capturado!`, 'success');
      this.uiManager.showScreenshot(result.screenshot);
    } catch (error: any) {
      if (error.details?.sessionExpired) {
        this.handleSessionExpired(this.currentSession.id);
      }
      this.uiManager.log(`❌ Erro ao capturar screenshot: ${error.details?.error || error.message}`, 'error');
    } finally {
      this.uiManager.setLoading(false);
    }
  }

  async closeSession(): Promise<void> {
    if (!this.currentSession.active || !this.currentSession.id) {
      this.uiManager.log('❌ Nenhuma sessão ativa.', 'error');
      return;
    }

    this.uiManager.setSessionLoading(true);

    try {
      const footerCode = this.editors.footer?.state.doc.toString();
      if (footerCode && this.codeProcessingService.hasExecutableContent(footerCode)) {
        this.uiManager.log('🔍 Executando extração de dados...', 'info');
        try {
          const processingResult = this.codeProcessingService.processCode(footerCode, 'footer');
          if (processingResult.isValid) {
            const executeResult = await this.apiService.executeCode(this.currentSession.id, processingResult.processedCode);
            if (executeResult.result) {
              this.uiManager.showExtractionData(executeResult.result);
              this.uiManager.switchResultsTab('data');
            }
          }
        } catch (extractError: any) {
          this.uiManager.log(`⚠️ Erro na extração: ${extractError.details?.error || extractError.message}`, 'warning');
        }
      }

      await this.apiService.closeSession(this.currentSession.id);
      this.currentSession = { id: null, active: false, executionCount: 0, pageInfo: null };
      this.uiManager.updateSessionStatus();

    } catch (error: any) {
      this.uiManager.log(`❌ Erro ao fechar sessão: ${error.details?.error || error.message}`, 'error');
    } finally {
      this.uiManager.setSessionLoading(false);
    }
  }

  async toggleSession(): Promise<void> {
    if (this.currentSession.active) {
      await this.closeSession();
    } else {
      await this.createSession();
    }
  }

  handleSessionExpired(sessionId: string): void {
    if (this.currentSession.id === sessionId) {
      this.currentSession = { id: null, active: false, executionCount: 0, pageInfo: null };
      this.uiManager.updateSessionStatus();
      this.uiManager.hideResults();
      this.uiManager.log('🔄 Sessão resetada automaticamente devido à expiração.', 'warning');
    }
  }

  generateCodeAutomatically(forceOverwrite: boolean = false): void {
    const savedConfig = this.configService.loadConfig();
    const config = this.configService.getConfigFromForm();
    const codeSections = this.generateCodeSections(config);

    if (savedConfig.automationCode !== undefined && !forceOverwrite) {
      codeSections.automation = undefined;
    }
    if (savedConfig.footerCode !== undefined && !forceOverwrite) {
      codeSections.footer = undefined;
    }

    this.editorManager.displayGeneratedCodeSections(codeSections);
  }

  generateCodeSections(config: AppConfig): { header: string; automation?: string; footer?: string; } {
    const { automationCode, footerCode, ...executionConfig } = config;
    const configJson = JSON.stringify(executionConfig, null, 2);
    
    return {
      header: `import { newPage } from '@felinto-dev/felinto-connect-bot';\n\nconst page = await newPage(${configJson});`,
      automation: `// Testes básicos...\nconst title = await page.title();\nconsole.log('Título:', title);`,
      footer: `// Capturar informações...\nconst finalUrl = await page.url();\nreturn { finalUrl };`
    };
  }

  async copyGeneratedCode(): Promise<void> {
    const copyBtn = document.getElementById('copyCodeBtn') as HTMLButtonElement;
    if (!this.editors.header || !this.editors.automation || !this.editors.footer) {
      this.uiManager.log('⚠️ Editores não inicializados', 'warning');
      return;
    }
    
    const textToCopy = [
      this.editors.header.state.doc.toString(),
      this.editors.automation.state.doc.toString(),
      this.editors.footer.state.doc.toString()
    ].join('\n\n');
    
    if (!textToCopy.trim()) {
      this.uiManager.log('⚠️ Nenhum código para copiar', 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      this.uiManager.log('📋 Código completo copiado para clipboard!', 'success');
      this.uiManager.showTemporaryFeedback(copyBtn, 'Sucesso!', 'check');
    } catch (error: any) {
      this.uiManager.log(`❌ Erro ao copiar código: ${error.message}`, 'error');
    }
  }

  setupDropdownListeners(): void {
    const dropdownBtn = document.getElementById('importDropdownBtn');
    const dropdown = dropdownBtn?.closest('.dropdown');
    
    if (!dropdownBtn || !dropdown) return;
    
    dropdownBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.classList.remove('open');
      }
    });
  }

  setupNavigationListeners(): void {
    // Configurar listeners para os links de navegação
    document.querySelectorAll<HTMLAnchorElement>('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Não fazer nada se o link estiver desabilitado
        if (link.classList.contains('disabled')) {
          this.uiManager.log('⚠️ Esta funcionalidade estará disponível em breve!', 'warning');
          return;
        }
        
        const page = link.dataset.page;
        if (page) {
          this.navigateToPage(page);
        }
      });
    });
  }

  navigateToPage(page: string): void {
    // Remover classe active de todos os links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    
    // Adicionar classe active ao link atual
    const currentLink = document.querySelector(`[data-page="${page}"]`);
    if (currentLink) {
      currentLink.classList.add('active');
    }
    
    // Navegar para a página correspondente
    switch (page) {
      case 'playground':
        this.showPlaygroundPage();
        this.uiManager.log('📱 Navegando para Playground', 'info');
        break;
      case 'recording':
        this.showRecordingPage();
        this.uiManager.log('🎥 Navegando para Gravação da Sessão', 'info');
        break;
      default:
        this.uiManager.log(`❌ Página "${page}" não encontrada`, 'error');
    }
  }

  setupPageNavigation(): void {
    // Inicializar navegação de páginas
    this.showPlaygroundPage(); // Mostrar playground por padrão
  }

  showPlaygroundPage(): void {
    // Ocultar todas as páginas
    document.querySelectorAll('.page-content').forEach(page => {
      page.classList.remove('active');
    });
    
    // Mostrar página do playground
    const playgroundPage = document.getElementById('playgroundPage');
    if (playgroundPage) {
      playgroundPage.classList.add('active');
    }
    
    // Atualizar título da página
    document.title = 'Felinto Connect Bot - Debug Playground';
  }

  showRecordingPage(): void {
    // Ocultar todas as páginas
    document.querySelectorAll('.page-content').forEach(page => {
      page.classList.remove('active');
    });
    
    // Mostrar página de gravação
    const recordingPage = document.getElementById('recordingPage');
    if (recordingPage) {
      recordingPage.classList.add('active');
    }
    
    // Atualizar título da página
    document.title = 'Felinto Connect Bot - Gravação da Sessão';
    
    // Inicializar ícones na nova página
    setTimeout(() => {
      this.initializeIcons();
    }, 50);
  }

  async exportConfig(): Promise<void> {
    const exportBtn = document.getElementById('exportConfig') as HTMLButtonElement;
    try {
      const config = this.configService.getConfigFromForm();
      const configJson = JSON.stringify(config, null, 2);
      await navigator.clipboard.writeText(configJson);
      this.uiManager.log('✅ Configurações exportadas para o clipboard!', 'success');
      this.uiManager.showTemporaryFeedback(exportBtn, 'Sucesso!', 'check');
    } catch (error: any) {
      this.uiManager.log(`❌ Erro ao exportar: ${error.message}`, 'error');
    }
  }

  async importConfig(): Promise<void> {
    const importBtn = document.getElementById('importConfig') as HTMLButtonElement;
    try {
      const configText = await navigator.clipboard.readText();
      if (!configText.trim()) {
        this.uiManager.log('⚠️ Clipboard vazio.', 'warning');
        return;
      }
      const config = JSON.parse(configText.trim());
      this.configService.setConfigToForm(config);
      this.configService.saveConfig();
      this.uiManager.log('✅ Configurações importadas!', 'success');
      this.uiManager.showTemporaryFeedback(importBtn, 'Sucesso!', 'check');
    } catch (error: any) {
      this.uiManager.log(`❌ Erro ao importar: ${error.message}`, 'error');
    }
  }

  async importPuppeteerCookies(): Promise<void> {
    const importBtn = document.getElementById('importPuppeteerCookies') as HTMLButtonElement;
    try {
      const cookiesText = await navigator.clipboard.readText();
      const cookies = JSON.parse(cookiesText.trim());
      
      if (!Array.isArray(cookies)) throw new Error("O conteúdo não é um array de cookies.");

      const currentConfig = this.configService.getConfigFromForm();
      const newSessionData = { 
        ...(currentConfig.sessionData || {}), 
        cookies 
      };
      
      this.configService.setConfigToForm({ ...currentConfig, sessionData: newSessionData });
      this.configService.saveConfig();
      this.uiManager.log(`✅ ${cookies.length} cookies importados!`, 'success');
      this.uiManager.showTemporaryFeedback(importBtn, 'Sucesso!', 'check');
    } catch (error: any) {
      this.uiManager.log(`❌ Erro ao importar cookies: ${error.message}`, 'error');
    }
  }

  getTemplates(): Record<string, any> {
    // Implementação dos templates...
    return {};
  }

  applyTemplate(templateName: string): void {
    const template = this.templates[templateName];
    if (!template) return;
    this.uiManager.log(`Aplicando template: ${template.name}`, 'info');
    this.configService.setConfigToForm(template.config, true);
  }

  applySessionTemplate(templateName: string): void {
    let sessionData: SessionData;
    let templateDescription = '';
    
    switch (templateName) {
      case 'clear-all':
        sessionData = { cookies: [], localStorage: {}, sessionStorage: {} };
        templateDescription = 'Limpar Tudo';
        break;
      case 'clear-cookies':
        sessionData = { cookies: [] };
        templateDescription = 'Limpar Cookies';
        break;
      case 'clear-localStorage':
        sessionData = { localStorage: {} };
        templateDescription = 'Limpar localStorage';
        break;
      case 'clear-sessionStorage':
        sessionData = { sessionStorage: {} };
        templateDescription = 'Limpar sessionStorage';
        break;
      default:
        return;
    }
    
    this.uiManager.log(`🧹 Template aplicado: ${templateDescription}`, 'info');
    const currentConfig = this.configService.getConfigFromForm();
    const newConfig = { ...currentConfig, sessionData };
    this.configService.setConfigToForm(newConfig);
  }

  useCurrentUserAgent(): void {
    const userAgentEl = document.getElementById('userAgent') as HTMLInputElement;
    if (userAgentEl) {
      userAgentEl.value = navigator.userAgent;
      userAgentEl.dispatchEvent(new Event('input'));
      this.uiManager.log('🌐 User Agent do navegador atual aplicado.', 'info');
    }
  }

  clearUserAgent(): void {
    const userAgentEl = document.getElementById('userAgent') as HTMLInputElement;
    if (userAgentEl) {
      userAgentEl.value = '';
      userAgentEl.dispatchEvent(new Event('input'));
      this.uiManager.log('🧹 User Agent limpo.', 'info');
    }
  }

  applyResourcePreset(preset: string): void {
    const presets: Record<string, string[]> = {
      none: [],
      performance: ['image', 'stylesheet', 'font'],
      scraping: ['image', 'stylesheet', 'font', 'media'],
      minimal: ['image', 'font'],
      maximum: ['image', 'stylesheet', 'font', 'script', 'media', 'xhr', 'fetch', 'websocket', 'manifest']
    };
    const resources = presets[preset] || [];
    document.querySelectorAll<HTMLInputElement>('input[data-resource]').forEach(checkbox => {
      checkbox.checked = resources.includes(checkbox.dataset.resource!);
    });
    this.updateBlockedResourcesFromCheckboxes();
    this.updatePresetButtonState(resources);
  }

  updateBlockedResourcesFromCheckboxes(): void {
    const resources: string[] = [];
    document.querySelectorAll<HTMLInputElement>('input[data-resource]:checked').forEach(checkbox => {
      resources.push(checkbox.dataset.resource!);
    });
    this.updatePresetButtonState(resources);
    // Lógica para combinar com advanced e salvar...
  }

  updatePresetButtonState(checkedResources: string[]): void {
    const presets: Record<string, string[]> = {
      none: [],
      performance: ['image', 'stylesheet', 'font'],
      scraping: ['image', 'stylesheet', 'font', 'media'],
      minimal: ['image', 'font'],
      maximum: ['image', 'stylesheet', 'font', 'script', 'media', 'xhr', 'fetch', 'websocket', 'manifest']
    };

    // Remove a classe active de todos os botões
    document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Encontra qual preset corresponde aos recursos selecionados
    for (const [presetName, presetResources] of Object.entries(presets)) {
      const sortedChecked = [...checkedResources].sort();
      const sortedPreset = [...presetResources].sort();
      
      if (sortedChecked.length === sortedPreset.length && 
          sortedChecked.every((resource, index) => resource === sortedPreset[index])) {
        const presetBtn = document.querySelector<HTMLButtonElement>(`.preset-btn[data-preset="${presetName}"]`);
        if (presetBtn) {
          presetBtn.classList.add('active');
        }
        break;
      }
    }
  }

  updateBlockedResourcesFromAdvanced(): void {
    this.updateBlockedResourcesFromCheckboxes();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    window.app = new PlaygroundApp();
    window.playgroundApp = window.app;
  }, 100);
});
