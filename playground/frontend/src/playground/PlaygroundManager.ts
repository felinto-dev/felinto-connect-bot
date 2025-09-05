import { SharedServices } from '../shared';
import { AppConfig, SessionData } from '../shared/types';
import { PageInfo } from '../shared/types';

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

export class PlaygroundManager {
  private sharedServices: SharedServices;
  public currentSession: CurrentSession;
  public extractionData: ExtractionData;
  public config: AppConfig;
  public templates: Record<string, any>;

  constructor(sharedServices: SharedServices) {
    this.sharedServices = sharedServices;
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
    this.config = this.sharedServices.configService.loadConfig();
    this.templates = this.getTemplates();
  }

  public init(): void {
    this.setupEventListeners();
    this.loadSavedConfig();
    this.checkChromeStatus();
    this.generateCodeAutomatically();
  }

  private setupEventListeners(): void {
    // Botões principais
    document.getElementById('sessionToggleBtn')?.addEventListener('click', () => this.toggleSession());
    document.getElementById('executeCodeBtn')?.addEventListener('click', () => this.executeCode());
    document.getElementById('executeExtractionBtn')?.addEventListener('click', () => this.executeExtraction());
    document.getElementById('takeScreenshotBtn')?.addEventListener('click', () => this.takeScreenshot());

    // Configurações
    document.getElementById('importConfig')?.addEventListener('click', () => this.importConfig());
    document.getElementById('importPuppeteerCookies')?.addEventListener('click', () => this.importPuppeteerCookies());
    document.getElementById('exportConfig')?.addEventListener('click', () => this.exportConfig());
    document.getElementById('copyCodeBtn')?.addEventListener('click', () => this.copyGeneratedCode());
    document.getElementById('validateWSEndpoint')?.addEventListener('click', () => this.validateWebSocketEndpoint());

    // Toggles de seção
    document.getElementById('toggleAdvancedConfig')?.addEventListener('click', () => this.toggleAdvancedConfig());
    document.getElementById('toggleConfigSection')?.addEventListener('click', () => this.toggleConfigSection());
    document.getElementById('toggleExecutionSection')?.addEventListener('click', () => this.toggleExecutionSection());

    // Templates
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

    // User Agent
    document.getElementById('useCurrentUserAgent')?.addEventListener('click', () => this.useCurrentUserAgent());
    document.getElementById('clearUserAgent')?.addEventListener('click', () => this.clearUserAgent());

    // Resource blocking
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

    // Results tabs
    document.addEventListener('click', (e: MouseEvent) => {
      const tabBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab-btn');
      if (tabBtn) {
        this.switchResultsTab(tabBtn.dataset.tab as any);
      }
    });

    // Auto-save
    this.setupAutoSave();
  }

  private setupAutoSave(): void {
    document.querySelectorAll('input, textarea, select').forEach(input => {
      input.addEventListener('input', () => {
        this.sharedServices.configService.saveConfig();
        this.generateCodeAutomatically();
      });
    });
  }

  private loadSavedConfig(): void {
    this.sharedServices.configService.loadSavedConfig();
  }

  private async checkChromeStatus(): Promise<void> {
    try {
      await this.sharedServices.apiService.checkChromeStatus();
      const executeBtn = document.getElementById('executeBtn') as HTMLButtonElement | null;
      if (executeBtn) executeBtn.disabled = false;
    } catch (error: any) {
      const executeBtn = document.getElementById('executeBtn') as HTMLButtonElement | null;
      if (executeBtn) executeBtn.disabled = true;
      console.warn(`⚠️ ${error.message}`);
    }
  }

  private generateCodeAutomatically(forceOverwrite: boolean = false): void {
    const savedConfig = this.sharedServices.configService.loadConfig();
    const config = this.sharedServices.configService.getConfigFromForm();
    const codeSections = this.generateCodeSections(config);

    if (savedConfig.automationCode !== undefined && !forceOverwrite) {
      codeSections.automation = undefined;
    }
    if (savedConfig.footerCode !== undefined && !forceOverwrite) {
      codeSections.footer = undefined;
    }

    // Aqui seria chamado o EditorManager para exibir o código
  }

  private generateCodeSections(config: AppConfig): { header: string; automation?: string; footer?: string; } {
    const { automationCode, footerCode, ...executionConfig } = config;
    const configJson = JSON.stringify(executionConfig, null, 2);
    
    return {
      header: `import { newPage } from '@felinto-dev/felinto-connect-bot';\n\nconst page = await newPage(${configJson});`,
      automation: `// Testes básicos...\nconst title = await page.title();\nconsole.log('Título:', title);`,
      footer: `// Capturar informações...\nconst finalUrl = await page.url();\nreturn { finalUrl };`
    };
  }

  private async toggleSession(): Promise<void> {
    if (this.currentSession.active) {
      await this.closeSession();
    } else {
      await this.createSession();
    }
  }

  private async createSession(): Promise<void> {
    const config = this.sharedServices.configService.getConfigFromForm();
    if (!this.sharedServices.configService.validateConfig(config)) return;


    try {
      const result = await this.sharedServices.apiService.createSession(config);
      this.currentSession = {
        id: result.sessionId,
        active: true,
        executionCount: 0,
        pageInfo: result.pageInfo || null
      };
      
      this.updateSessionStatus();
      
    } catch (error: any) {
      console.error(`❌ Erro ao criar sessão: ${error.details?.error || error.message}`);
    }
  }

  private async closeSession(): Promise<void> {
    if (!this.currentSession.active || !this.currentSession.id) {
      console.error('❌ Nenhuma sessão ativa.');
      return;
    }

    try {
      await this.sharedServices.apiService.closeSession(this.currentSession.id);
      this.currentSession = { id: null, active: false, executionCount: 0, pageInfo: null };
      this.updateSessionStatus();
    } catch (error: any) {
      console.error(`❌ Erro ao fechar sessão: ${error.details?.error || error.message}`);
    }
  }

  private async executeCode(): Promise<void> {
    if (!this.currentSession.active || !this.currentSession.id) {
      console.error('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.');
      return;
    }

    // Implementar execução do código
  }

  private async executeExtraction(): Promise<void> {
    if (!this.currentSession.active || !this.currentSession.id) {
      console.error('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.');
      return;
    }

    // Implementar extração de dados
  }

  private async takeScreenshot(): Promise<void> {
    if (!this.currentSession.active || !this.currentSession.id) {
      console.error('❌ Nenhuma sessão ativa. Crie uma sessão primeiro.');
      return;
    }

    // Implementar captura de screenshot
  }

  private updateSessionStatus(): void {
    const sessionBtn = document.getElementById('sessionToggleBtn') as HTMLButtonElement;
    const executeBtn = document.getElementById('executeCodeBtn') as HTMLButtonElement;
    const extractionBtn = document.getElementById('executeExtractionBtn') as HTMLButtonElement;
    const screenshotBtn = document.getElementById('takeScreenshotBtn') as HTMLButtonElement;

    if (this.currentSession.active) {
      if (sessionBtn) {
        sessionBtn.innerHTML = '<i data-lucide="x-circle"></i> Fechar Sessão';
        sessionBtn.className = 'btn btn-danger';
      }
      if (executeBtn) executeBtn.disabled = false;
      if (extractionBtn) extractionBtn.disabled = false;
      if (screenshotBtn) screenshotBtn.disabled = false;
    } else {
      if (sessionBtn) {
        sessionBtn.innerHTML = '<i data-lucide="plus-circle"></i> Criar Sessão';
        sessionBtn.className = 'btn btn-success';
      }
      if (executeBtn) executeBtn.disabled = true;
      if (extractionBtn) extractionBtn.disabled = true;
      if (screenshotBtn) screenshotBtn.disabled = true;
    }

    // Reinicializar ícones
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  }

  // Métodos de configuração e templates
  private async importConfig(): Promise<void> {
    try {
      const configText = await navigator.clipboard.readText();
      if (!configText.trim()) {
        console.warn('⚠️ Clipboard vazio.');
        return;
      }
      const config = JSON.parse(configText.trim());
      this.sharedServices.configService.setConfigToForm(config);
      this.sharedServices.configService.saveConfig();
    } catch (error: any) {
      console.error(`❌ Erro ao importar: ${error.message}`);
    }
  }

  private async importPuppeteerCookies(): Promise<void> {
    try {
      const cookiesText = await navigator.clipboard.readText();
      const cookies = JSON.parse(cookiesText.trim());
      
      if (!Array.isArray(cookies)) throw new Error("O conteúdo não é um array de cookies.");

      const currentConfig = this.sharedServices.configService.getConfigFromForm();
      const newSessionData = { 
        ...(currentConfig.sessionData || {}), 
        cookies 
      };
      
      this.sharedServices.configService.setConfigToForm({ ...currentConfig, sessionData: newSessionData });
      this.sharedServices.configService.saveConfig();
    } catch (error: any) {
      console.error(`❌ Erro ao importar cookies: ${error.message}`);
    }
  }

  private async exportConfig(): Promise<void> {
    try {
      const config = this.sharedServices.configService.getConfigFromForm();
      const configJson = JSON.stringify(config, null, 2);
      await navigator.clipboard.writeText(configJson);
    } catch (error: any) {
      console.error(`❌ Erro ao exportar: ${error.message}`);
    }
  }

  private async copyGeneratedCode(): Promise<void> {
    // Implementar cópia do código gerado
  }

  private async validateWebSocketEndpoint(): Promise<void> {
    const endpointInput = document.getElementById('browserWSEndpoint') as HTMLInputElement;
    
    if (!endpointInput) return;
    
    const endpoint = endpointInput.value.trim();
    if (!endpoint) {
      console.error('Por favor, insira uma URL WebSocket para validar');
      return;
    }
    
    if (!endpoint.startsWith('ws://') && !endpoint.startsWith('wss://')) {
      console.error('URL deve começar com ws:// ou wss://');
      return;
    }
    
    
    try {
      const data = await this.sharedServices.apiService.validateWebSocketEndpoint(endpoint);
    } catch (error: any) {
      console.error(`❌ Erro na validação: ${error.message}`);
    }
  }

  private getTemplates(): Record<string, any> {
    return {
      basic: {
        name: 'Básico',
        config: {
          initialUrl: 'https://example.com',
          userAgent: '',
          slowMo: 0,
          timeout: 30
        }
      },
      ecommerce: {
        name: 'E-commerce',
        config: {
          initialUrl: 'https://shopify.com',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          slowMo: 100,
          timeout: 60
        }
      }
    };
  }

  private applyTemplate(templateName: string): void {
    const template = this.templates[templateName];
    if (!template) return;
    this.sharedServices.configService.setConfigToForm(template.config, true);
  }

  private applySessionTemplate(templateName: string): void {
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
    
    const currentConfig = this.sharedServices.configService.getConfigFromForm();
    const newConfig = { ...currentConfig, sessionData };
    this.sharedServices.configService.setConfigToForm(newConfig);
  }

  private useCurrentUserAgent(): void {
    const userAgentEl = document.getElementById('userAgent') as HTMLInputElement;
    if (userAgentEl) {
      userAgentEl.value = navigator.userAgent;
      userAgentEl.dispatchEvent(new Event('input'));
    }
  }

  private clearUserAgent(): void {
    const userAgentEl = document.getElementById('userAgent') as HTMLInputElement;
    if (userAgentEl) {
      userAgentEl.value = '';
      userAgentEl.dispatchEvent(new Event('input'));
    }
  }

  private applyResourcePreset(preset: string): void {
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

  private updateBlockedResourcesFromCheckboxes(): void {
    const resources: string[] = [];
    document.querySelectorAll<HTMLInputElement>('input[data-resource]:checked').forEach(checkbox => {
      resources.push(checkbox.dataset.resource!);
    });
    this.updatePresetButtonState(resources);
  }

  private updatePresetButtonState(checkedResources: string[]): void {
    const presets: Record<string, string[]> = {
      none: [],
      performance: ['image', 'stylesheet', 'font'],
      scraping: ['image', 'stylesheet', 'font', 'media'],
      minimal: ['image', 'font'],
      maximum: ['image', 'stylesheet', 'font', 'script', 'media', 'xhr', 'fetch', 'websocket', 'manifest']
    };

    document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach(btn => {
      btn.classList.remove('active');
    });

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

  private toggleAdvancedConfig(): void {
    // Implementar toggle de configurações avançadas
  }

  private toggleConfigSection(): void {
    // Implementar toggle de seção de configuração
  }

  private toggleExecutionSection(): void {
    // Implementar toggle de seção de execução
  }

  private switchResultsTab(tab: string): void {
    // Implementar troca de aba de resultados
  }
}
