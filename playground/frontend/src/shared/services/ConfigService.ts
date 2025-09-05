import { AppConfig, SessionData } from '../types/config';

export default class ConfigService {
  private app: any;
  private isLoadingConfig: boolean;
  private editors: any = null; // Referência aos editores, será definida depois
  private playgroundApp: any = null; // Referência ao PlaygroundApp para métodos específicos

  constructor(app: any) {
    this.app = app;
    this.isLoadingConfig = false;
  }

  // Método para definir os editores após eles serem criados
  setEditors(editors: any): void {
    this.editors = editors;
  }

  // Método para definir referência ao PlaygroundApp
  setPlaygroundApp(playgroundApp: any): void {
    this.playgroundApp = playgroundApp;
  }

  getConfigFromForm(): AppConfig {
    const config: AppConfig = {};

    const slowMoEl = document.getElementById('slowMo') as HTMLInputElement;
    if (slowMoEl) {
      const slowMoValue = slowMoEl.value.trim();
      const slowMo = slowMoValue === '' ? 0 : parseInt(slowMoValue, 10);
      if (!isNaN(slowMo)) config.slowMo = slowMo;
    }

    const timeoutEl = document.getElementById('timeout') as HTMLInputElement;
    if (timeoutEl) {
      const timeout = parseInt(timeoutEl.value, 10);
      if (timeout > 0) config.timeout = timeout * 1000; // Convert to ms
    }

    const userAgentEl = document.getElementById('userAgent') as HTMLInputElement;
    if (userAgentEl) {
      const userAgent = userAgentEl.value.trim();
      if (userAgent) config.userAgent = userAgent;
    }

    const browserWSEndpointEl = document.getElementById('browserWSEndpoint') as HTMLInputElement;
    if (browserWSEndpointEl) {
      const browserWSEndpoint = browserWSEndpointEl.value.trim();
      if (browserWSEndpoint) config.browserWSEndpoint = browserWSEndpoint;
    }

    const initialUrlEl = document.getElementById('initialUrl') as HTMLInputElement;
    if (initialUrlEl) {
      const initialUrl = initialUrlEl.value.trim();
      if (initialUrl) config.initialUrl = initialUrl;
    }

    let sessionDataValue = '';
    if (this.editors && this.editors.sessionData) {
      sessionDataValue = this.editors.sessionData.state.doc.toString().trim();
    }
    
    if (sessionDataValue) {
      try {
        const parsedSessionData: SessionData = JSON.parse(sessionDataValue);
        if (Object.keys(parsedSessionData).length > 0) {
          config.sessionData = parsedSessionData;
        }
      } catch (error) {
        console.error('❌ Erro no JSON do Session Data:', error);
      }
    }

    if (this.editors && this.editors.automation) {
      config.automationCode = this.editors.automation.state.doc.toString();
    }
    if (this.editors && this.editors.footer) {
      config.footerCode = this.editors.footer.state.doc.toString();
    }

    const checkedResources: string[] = [];
    document.querySelectorAll<HTMLInputElement>('input[data-resource]:checked').forEach(checkbox => {
      checkedResources.push(checkbox.dataset.resource!);
    });
    
    const blockedResourcesTypesEl = document.getElementById('blockedResourcesTypes') as HTMLInputElement;
    let advancedResources: string[] = [];
    if (blockedResourcesTypesEl) {
      const advancedValue = blockedResourcesTypesEl.value.trim();
      if (advancedValue) {
        advancedResources = advancedValue.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    
    const allResources = [...new Set([...checkedResources, ...advancedResources])];
    if (allResources.length > 0) {
      config.blockedResourcesTypes = allResources;
    }

    if (this.app.constantsManager) {
      const constants = this.app.constantsManager.getConstantsForConfig();
      if (Object.keys(constants).length > 0) {
        config.constants = constants;
      }
    }
    
    return config;
  }

  validateConfig(config: AppConfig): boolean {
    if (config.initialUrl && !this.isValidUrl(config.initialUrl)) {
      console.warn('URL inicial inválida');
      return false;
    }
    return true;
  }

  isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
  
  setConfigToForm(config: AppConfig, isApplyingTemplate: boolean = false): void {
    const slowMoEl = document.getElementById('slowMo') as HTMLInputElement;
    if (slowMoEl && config.hasOwnProperty('slowMo')) {
      slowMoEl.value = String(config.slowMo ?? 0);
    }
    
    const timeoutEl = document.getElementById('timeout') as HTMLInputElement;
    if (timeoutEl && config.timeout) timeoutEl.value = String(config.timeout / 1000);
    
    const userAgentEl = document.getElementById('userAgent') as HTMLInputElement;
    if (userAgentEl && config.userAgent) userAgentEl.value = config.userAgent;
    
    const browserWSEndpointEl = document.getElementById('browserWSEndpoint') as HTMLInputElement;
    if (browserWSEndpointEl && config.browserWSEndpoint) browserWSEndpointEl.value = config.browserWSEndpoint;
    
    const initialUrlEl = document.getElementById('initialUrl') as HTMLInputElement;
    if (initialUrlEl && config.initialUrl) initialUrlEl.value = config.initialUrl;

    if (this.editors && this.editors.sessionData && config.sessionData) {
      const jsonString = JSON.stringify(config.sessionData, null, 2);
      this.editors.sessionData.dispatch({
        changes: { from: 0, to: this.editors.sessionData.state.doc.length, insert: jsonString }
      });
    }

    if (this.editors && this.editors.automation && config.automationCode !== undefined) {
      this.editors.automation.dispatch({
        changes: { from: 0, to: this.editors.automation.state.doc.length, insert: config.automationCode }
      });
    }

    if (this.editors && this.editors.footer && config.footerCode !== undefined) {
      this.editors.footer.dispatch({
        changes: { from: 0, to: this.editors.footer.state.doc.length, insert: config.footerCode }
      });
    }

    if (config.blockedResourcesTypes) {
      const resources = config.blockedResourcesTypes;
      const commonResources = ['image', 'stylesheet', 'font', 'script', 'media', 'xhr', 'fetch', 'websocket', 'manifest'];
      document.querySelectorAll<HTMLInputElement>('input[data-resource]').forEach(checkbox => {
        checkbox.checked = resources.includes(checkbox.dataset.resource!);
      });
      
      const advancedResources = resources.filter(r => !commonResources.includes(r));
      const blockedResourcesTypesEl = document.getElementById('blockedResourcesTypes') as HTMLInputElement;
      if (blockedResourcesTypesEl) {
        blockedResourcesTypesEl.value = advancedResources.join(', ');
      }
      
      if (this.app.updatePresetButtonState) {
        const checkedResources = resources.filter(r => commonResources.includes(r));
        this.app.updatePresetButtonState(checkedResources);
      }
    } else {
      document.querySelectorAll<HTMLInputElement>('input[data-resource]').forEach(checkbox => {
        checkbox.checked = false;
      });
      const blockedResourcesTypesEl = document.getElementById('blockedResourcesTypes') as HTMLInputElement;
      if (blockedResourcesTypesEl) {
        blockedResourcesTypesEl.value = '';
      }
    }

    if (config.constants && this.app.constantsManager) {
      this.app.constantsManager.setConstants(config.constants);
    }

    if (!isApplyingTemplate) {
      this.saveConfig();
    }
    
    if (this.playgroundApp && this.playgroundApp.generateCodeAutomatically) {
      this.playgroundApp.generateCodeAutomatically(isApplyingTemplate);
    }
  }

  saveAdvancedConfigState(isExpanded: boolean): void {
    localStorage.setItem('playground-advanced-config-expanded', JSON.stringify(isExpanded));
  }
  
  loadAdvancedConfigState(): void {
    try {
      const saved = localStorage.getItem('playground-advanced-config-expanded');
      const isExpanded = saved ? JSON.parse(saved) : false;
      
      const toggleBtn = document.getElementById('toggleAdvancedConfig');
      const content = document.getElementById('advancedConfigContent');
      
      if (!toggleBtn || !content) return;
      
      if (isExpanded) {
        content.classList.remove('collapsed');
        toggleBtn.classList.add('expanded');
        toggleBtn.querySelector('.toggle-text')!.textContent = 'Ocultar Configurações';
      } else {
        content.classList.add('collapsed');
        toggleBtn.classList.remove('expanded');
        toggleBtn.querySelector('.toggle-text')!.textContent = 'Mostrar Configurações';
      }
    } catch (error) {
      console.warn('Erro ao carregar estado das configurações avançadas:', error);
    }
  }

  loadSectionStates(): void {
    this.loadConfigSectionState();
    this.loadExecutionSectionState();
  }

  loadConfigSectionState(): void {
    try {
      const saved = localStorage.getItem('playground-config-section-collapsed');
      const isCollapsed = saved ? JSON.parse(saved) : false;
      
      const toggleBtn = document.getElementById('toggleConfigSection');
      const content = document.getElementById('configSectionContent');
      
      if (!toggleBtn || !content) return;
      
      if (isCollapsed) {
        content.classList.add('collapsed');
        toggleBtn.classList.add('collapsed');
        toggleBtn.querySelector('.toggle-text')!.textContent = 'Expandir';
      } else {
        content.classList.remove('collapsed');
        toggleBtn.classList.remove('collapsed');
        toggleBtn.querySelector('.toggle-text')!.textContent = 'Recolher';
      }
    } catch (error) {
      console.warn('Erro ao carregar estado da seção de configurações:', error);
    }
  }

  loadExecutionSectionState(): void {
    try {
      const saved = localStorage.getItem('playground-execution-section-collapsed');
      const isCollapsed = saved ? JSON.parse(saved) : false;
      
      const toggleBtn = document.getElementById('toggleExecutionSection');
      const content = document.getElementById('executionSectionContent');
      
      if (!toggleBtn || !content) return;
      
      if (isCollapsed) {
        content.classList.add('collapsed');
        toggleBtn.classList.add('collapsed');
        toggleBtn.querySelector('.toggle-text')!.textContent = 'Expandir';
      } else {
        content.classList.remove('collapsed');
        toggleBtn.classList.remove('collapsed');
        toggleBtn.querySelector('.toggle-text')!.textContent = 'Recolher';
      }
    } catch (error) {
      console.warn('Erro ao carregar estado da seção de execução:', error);
    }
  }

  saveConfig(): void {
    if (this.isLoadingConfig) {
      return;
    }
    
    const config = this.getConfigFromForm();
    localStorage.setItem('playground-config', JSON.stringify(config));
  }

  loadConfig(): AppConfig {
    try {
      const saved = localStorage.getItem('playground-config');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('❌ Erro ao carregar config do localStorage:', error);
      return {};
    }
  }

  loadSavedConfig(): void {
    this.isLoadingConfig = true;
    
    const config = this.loadConfig();
    if (config && Object.keys(config).length > 0) {
      this.setConfigToForm(config);
    }
    
    setTimeout(() => {
      this.isLoadingConfig = false;
    }, 500);
  }
}
