import './style.css'

class PlaygroundApp {
  constructor() {
    this.ws = null;
    this.config = this.loadConfig();
    this.templates = this.getTemplates();
    
    this.init();
  }

  init() {
    this.setupWebSocket();
    this.setupEventListeners();
    this.loadSavedConfig();
    this.checkChromeStatus();
    this.initializeIcons();
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
        case 'checkChrome':
          e.preventDefault();
          this.checkChromeConnection();
          break;
          
        case 'executeBtn':
          e.preventDefault();
          this.executeSession();
          break;
          
        case 'generateCode':
          e.preventDefault(); 
          this.generateCode();
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

    this.setupAutoSave();
  }

  setupAutoSave() {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.saveConfig();
      });
    });
  }

  // Chrome Status
  async checkChromeStatus() {
    this.updateStatus('Verificando Chrome...', 'checking');
    
    try {
      const response = await fetch('/api/chrome/check');
      const result = await response.json();
      
      if (result.available) {
        this.updateStatus('Chrome conectado', 'connected');
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) executeBtn.disabled = false;
      } else {
        this.updateStatus('Chrome não encontrado', 'warning');
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
      this.updateStatus('Erro na verificação', 'error');
      this.log(`Erro ao verificar Chrome: ${error.message}`, 'error');
    }
  }

  async checkChromeConnection() {
    this.log('Verificando conexão com Chrome...', 'info');
    await this.checkChromeStatus();
  }

  updateStatus(text, status = 'checking') {
    const statusElement = document.querySelector('.connection-status');
    if (statusElement) {
      const iconElement = statusElement.querySelector('.status-icon');
      const textElement = statusElement.querySelector('.status-text');
      
      if (textElement) textElement.textContent = text;
      
      if (iconElement) {
        // Usar setAttribute para compatibilidade com SVG
        iconElement.setAttribute('class', 'status-icon');
        
        // Mudar ícone baseado no status
        if (status === 'connected') {
          iconElement.setAttribute('class', 'status-icon connected');
          iconElement.setAttribute('data-lucide', 'wifi');
        } else if (status === 'warning') {
          iconElement.setAttribute('class', 'status-icon warning');
          iconElement.setAttribute('data-lucide', 'wifi-off');
        } else {
          iconElement.setAttribute('class', 'status-icon');
          iconElement.setAttribute('data-lucide', 'loader');
        }
        
        // Re-inicializar ícones após mudança
        try {
          if (typeof lucide !== 'undefined') {
            lucide.createIcons();
          }
        } catch (error) {
          console.warn('Erro ao re-inicializar ícones:', error);
        }
      }
    }
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

  // Generate Code
  async generateCode() {
    const config = this.getConfigFromForm();
    
    try {
      const response = await fetch('/api/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });

      const result = await response.json();
      
      if (response.ok) {
        // Copiar código para clipboard ou mostrar em uma modal
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(result.code);
          this.log('Código gerado e copiado para clipboard!', 'success');
        } else {
          this.log('Código gerado com sucesso!', 'success');
        }
      } else {
        this.log(`Erro ao gerar código: ${result.error}`, 'error');
      }

    } catch (error) {
      this.log(`Erro: ${error.message}`, 'error');
    }
  }

  // Config Management
  getConfigFromForm() {
    const config = {};

    const slowMoEl = document.getElementById('slowMo');
    if (slowMoEl) {
      const slowMo = parseInt(slowMoEl.value);
      if (slowMo > 0) config.slowMo = slowMo;
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

    const initialUrlEl = document.getElementById('initialUrl');
    if (initialUrlEl) {
      const initialUrl = initialUrlEl.value.trim();
      if (initialUrl) config.initialUrl = initialUrl;
    }

    const sessionDataEl = document.getElementById('sessionData');
    if (sessionDataEl) {
      try {
        const sessionData = sessionDataEl.value.trim();
        if (sessionData) {
          const parsedSessionData = JSON.parse(sessionData);
          
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
            }
          }
        }
      } catch (error) {
        this.log('Erro no JSON do session data', 'warning');
      }
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
          slowMo: 1000,
          timeout: 60,
          initialUrl: 'https://example.com'
        }
      },
      ecommerce: {
        name: '🛒 E-commerce',
        config: {
          slowMo: 500,
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
          slowMo: 800,
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
          slowMo: 200,
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
  }

  applySessionTemplate(templateName) {
    const sessionDataEl = document.getElementById('sessionData');
    if (!sessionDataEl) return;

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

    // Aplicar o JSON formatado ao textarea
    sessionDataEl.value = JSON.stringify(sessionData, null, 2);
    
    // Trigger input event to save config
    sessionDataEl.dispatchEvent(new Event('input'));
  }

  setConfigToForm(config) {
    const slowMoEl = document.getElementById('slowMo');
    if (slowMoEl && config.slowMo) slowMoEl.value = config.slowMo;
    
    const timeoutEl = document.getElementById('timeout');
    if (timeoutEl && config.timeout) timeoutEl.value = config.timeout;
    
    const userAgentEl = document.getElementById('userAgent');
    if (userAgentEl && config.userAgent) userAgentEl.value = config.userAgent;
    
    const initialUrlEl = document.getElementById('initialUrl');
    if (initialUrlEl && config.initialUrl) initialUrlEl.value = config.initialUrl;

    // Construir o sessionData combinando cookies e sessionData
    const sessionDataObj = {};
    
    // Incluir SEMPRE que definido (mesmo se vazio)
    if (config.cookies !== undefined) {
      sessionDataObj.cookies = config.cookies;
    }
    
    if (config.sessionData?.localStorage !== undefined) {
      sessionDataObj.localStorage = config.sessionData.localStorage;
    }
    
    if (config.sessionData?.sessionStorage !== undefined) {
      sessionDataObj.sessionStorage = config.sessionData.sessionStorage;
    }
    
    const sessionDataEl = document.getElementById('sessionData');
    // SEMPRE mostrar se houver alguma propriedade definida (mesmo se vazia)
    if (sessionDataEl && (config.cookies !== undefined || 
                          config.sessionData?.localStorage !== undefined ||
                          config.sessionData?.sessionStorage !== undefined)) {
      sessionDataEl.value = JSON.stringify(sessionDataObj, null, 2);
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
  }

  // Config Persistence
  saveConfig() {
    const config = this.getConfigFromForm();
    localStorage.setItem('playground-config', JSON.stringify(config));
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem('playground-config');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }

  loadSavedConfig() {
    if (Object.keys(this.config).length > 0) {
      this.setConfigToForm(this.config);
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Aguardar um pouco para garantir que tudo carregou
  setTimeout(() => {
    window.playgroundApp = new PlaygroundApp();
  }, 100);
});