export default class ConfigService {
  constructor(app) {
    this.app = app;
    this.isLoadingConfig = false;
  }

  getConfigFromForm() {
    const config = {};

    const slowMoEl = document.getElementById('slowMo');
    if (slowMoEl) {
      const slowMoValue = slowMoEl.value.trim();
      const slowMo = slowMoValue === '' ? 0 : parseInt(slowMoValue);
      if (!isNaN(slowMo)) config.slowMo = slowMo;
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

    let sessionDataValue = '';
    if (this.app.editors.sessionData) {
      sessionDataValue = this.app.editors.sessionData.state.doc.toString().trim();
    } else {
      const sessionDataEl = document.getElementById('sessionData');
      if (sessionDataEl) {
        sessionDataValue = sessionDataEl.value.trim();
      }
    }
    
    if (sessionDataValue) {
      try {
        let correctedJson = sessionDataValue;
        
        if (correctedJson.includes('cookies:') || correctedJson.includes('localStorage:') || correctedJson.includes('sessionStorage:')) {
          correctedJson = correctedJson
            .replace(/(\s*)cookies(\s*):/g, '$1"cookies"$2:')
            .replace(/(\s*)localStorage(\s*):/g, '$1"localStorage"$2:')
            .replace(/(\s*)sessionStorage(\s*):/g, '$1"sessionStorage"$2:');
          
          this.app.log('🔧 JSON corrigido automaticamente (adicionadas aspas nas chaves)', 'info');
        }
        
        const parsedSessionData = JSON.parse(correctedJson);
          
          const keys = Object.keys(parsedSessionData);
          if (keys.length === 0) {
            config.sessionData = {
              cookies: [],
              localStorage: {},
              sessionStorage: {}
            };
          } else {
            config.sessionData = parsedSessionData;
          }
      } catch (error) {
        this.app.log(`❌ Erro no JSON do Session Data: ${error.message}`, 'error');
        this.app.log('💡 Dica: Verifique se as chaves estão entre aspas (ex: "cookies" ao invés de cookies)', 'warning');
        console.error('Session Data JSON Error:', error);
        console.log('Valor problemático:', sessionDataValue);
      }
    }

    if (this.app.editors.automation) {
      config.automationCode = this.app.editors.automation.state.doc.toString();
    }
    if (this.app.editors.footer) {
      config.footerCode = this.app.editors.footer.state.doc.toString();
    }

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
    
    // Adicionar constantes se disponíveis
    if (this.app.constantsManager) {
      const constants = this.app.constantsManager.getConstantsForConfig();
      if (Object.keys(constants).length > 0) {
        config.constants = constants;
      }
    }
    
    return config;
  }

  validateConfig(config) {
    if (config.initialUrl && !this.isValidUrl(config.initialUrl)) {
      this.app.log('URL inicial inválida', 'warning');
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
  
  setConfigToForm(config, isApplyingTemplate = false) {
    const slowMoEl = document.getElementById('slowMo');
    if (slowMoEl && config.hasOwnProperty('slowMo')) {
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

    let sessionDataObj = {};
    if (config.sessionData && typeof config.sessionData === 'object') {
      sessionDataObj = { ...config.sessionData };
    }
    
    if (config.cookies !== undefined && !sessionDataObj.cookies) {
      sessionDataObj.cookies = config.cookies;
    }
    
    const hasSessionData = Object.keys(sessionDataObj).length > 0;
    const shouldUpdateSessionData = isApplyingTemplate || hasSessionData;
    
    if (this.app.editors.sessionData && shouldUpdateSessionData) {
      const jsonString = hasSessionData ? JSON.stringify(sessionDataObj, null, 2) : '{}';
      
      const transaction = this.app.editors.sessionData.state.update({
        changes: {
          from: 0,
          to: this.app.editors.sessionData.state.doc.length,
          insert: jsonString
        }
      });
      this.app.editors.sessionData.dispatch(transaction);
    } else {
      const sessionDataEl = document.getElementById('sessionData');
      if (sessionDataEl && shouldUpdateSessionData) {
        const jsonString = hasSessionData ? JSON.stringify(sessionDataObj, null, 2) : '{}';
        sessionDataEl.value = jsonString;
      }
    }

    if (this.app.editors.automation && config.automationCode !== undefined) {
      const automationTransaction = this.app.editors.automation.state.update({
        changes: {
          from: 0,
          to: this.app.editors.automation.state.doc.length,
          insert: config.automationCode
        }
      });
      this.app.editors.automation.dispatch(automationTransaction);
    }

    if (this.app.editors.footer && config.footerCode !== undefined) {
      const footerTransaction = this.app.editors.footer.state.update({
        changes: {
          from: 0,
          to: this.app.editors.footer.state.doc.length,
          insert: config.footerCode
        }
      });
      this.app.editors.footer.dispatch(footerTransaction);
    }

    const blockedResourcesTypesEl = document.getElementById('blockedResourcesTypes');
    if (blockedResourcesTypesEl && config.blockedResourcesTypes) {
      blockedResourcesTypesEl.value = config.blockedResourcesTypes.join(', ');
    }

    const waitUntilEl = document.getElementById('waitUntil');
    if (waitUntilEl && config.navigationOptions?.waitUntil) {
      waitUntilEl.value = config.navigationOptions.waitUntil;
    }

    // Carregar constantes se disponíveis
    if (config.constants && this.app.constantsManager) {
      this.app.constantsManager.setConstants(config.constants);
    }

    if (!isApplyingTemplate) {
      this.saveConfig();
    }
    
    this.app.generateCodeAutomatically(isApplyingTemplate);
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

  loadSectionStates() {
    this.loadConfigSectionState();
    this.loadExecutionSectionState();
  }

  loadConfigSectionState() {
    try {
      const saved = localStorage.getItem('playground-config-section-collapsed');
      const isCollapsed = saved ? JSON.parse(saved) : false; // Por padrão, expandido
      
      const toggleBtn = document.getElementById('toggleConfigSection');
      const content = document.getElementById('configSectionContent');
      
      if (!toggleBtn || !content) return;
      
      if (isCollapsed) {
        content.classList.add('collapsed');
        toggleBtn.classList.add('collapsed');
        toggleBtn.querySelector('.toggle-text').textContent = 'Expandir';
      } else {
        content.classList.remove('collapsed');
        toggleBtn.classList.remove('collapsed');
        toggleBtn.querySelector('.toggle-text').textContent = 'Recolher';
      }
      

    } catch (error) {
      console.warn('Erro ao carregar estado da seção de configurações:', error);
    }
  }

  loadExecutionSectionState() {
    try {
      const saved = localStorage.getItem('playground-execution-section-collapsed');
      const isCollapsed = saved ? JSON.parse(saved) : false; // Por padrão, expandido
      
      const toggleBtn = document.getElementById('toggleExecutionSection');
      const content = document.getElementById('executionSectionContent');
      
      if (!toggleBtn || !content) return;
      
      if (isCollapsed) {
        content.classList.add('collapsed');
        toggleBtn.classList.add('collapsed');
        toggleBtn.querySelector('.toggle-text').textContent = 'Expandir';
      } else {
        content.classList.remove('collapsed');
        toggleBtn.classList.remove('collapsed');
        toggleBtn.querySelector('.toggle-text').textContent = 'Recolher';
      }
      

    } catch (error) {
      console.warn('Erro ao carregar estado da seção de execução:', error);
    }
  }

  saveConfig() {
    if (this.isLoadingConfig) {
      return;
    }
    
    const config = this.getConfigFromForm();
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
    this.isLoadingConfig = true;
    
    const config = this.app.config;
    if (Object.keys(config).length > 0) {
      this.setConfigToForm(config);
    } else {
      console.log('📂 Nenhuma configuração salva encontrada');
    }
    
    setTimeout(() => {
      this.isLoadingConfig = false;
    }, 500);
  }
}
