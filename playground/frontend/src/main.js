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
    this.setupTabs();
    this.loadSavedConfig();
    this.checkChromeStatus();
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
        this.log('🔗 Conectado ao servidor', 'success');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.log(data.message, data.type);
        } catch (error) {
          this.log(`📨 ${event.data}`, 'info');
        }
      };

      this.ws.onclose = () => {
        this.log('❌ Conexão perdida. Tentando reconectar...', 'warning');
        setTimeout(() => this.connectWebSocket(url), 3000);
      };

      this.ws.onerror = () => {
        this.log('❌ Erro na conexão WebSocket', 'error');
      };

    } catch (error) {
      this.log(`❌ Erro ao conectar: ${error.message}`, 'error');
    }
  }

  // Event Listeners
  setupEventListeners() {
    document.getElementById('checkChrome').addEventListener('click', () => {
      this.checkChromeConnection();
    });

    document.getElementById('executeBtn').addEventListener('click', () => {
      this.executeSession();
    });

    document.getElementById('generateCode').addEventListener('click', () => {
      this.generateCode();
    });

    document.querySelectorAll('.template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const template = e.target.dataset.template;
        this.applyTemplate(template);
      });
    });

    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const text = e.target.dataset.copy;
        this.copyToClipboard(text);
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

  setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  // Chrome Status
  async checkChromeStatus() {
    this.updateStatus('Verificando Chrome...', 'checking');
    
    try {
      const response = await fetch('/api/chrome/check');
      const result = await response.json();
      
      if (result.available) {
        this.updateStatus('Chrome conectado', 'connected');
        document.getElementById('executeBtn').disabled = false;
      } else {
        this.updateStatus('Chrome não encontrado', 'warning');
        document.getElementById('executeBtn').disabled = true;
        this.log(`⚠️ ${result.error}`, 'warning');
        
        if (result.instructions) {
          this.log(`💡 ${result.instructions}`, 'info');
        }
        
        if (result.testedEndpoints) {
          this.log(`🔍 Endpoints testados: ${result.testedEndpoints.join(', ')}`, 'info');
        }
        
        if (result.troubleshooting) {
          this.log('🛠️ Troubleshooting:', 'info');
          result.troubleshooting.forEach(step => {
            this.log(`   ${step}`, 'info');
          });
        }
      }
    } catch (error) {
      this.updateStatus('Erro na verificação', 'error');
      this.log(`❌ Erro ao verificar Chrome: ${error.message}`, 'error');
    }
  }

  async checkChromeConnection() {
    this.log('🔍 Verificando conexão com Chrome...', 'info');
    await this.checkChromeStatus();
  }

  updateStatus(text, status = 'checking') {
    const statusElement = document.getElementById('status');
    const dotElement = statusElement.querySelector('.status-dot');
    const textElement = statusElement.querySelector('.status-text');
    
    textElement.textContent = text;
    
    dotElement.className = 'status-dot';
    if (status === 'connected') {
      dotElement.classList.add('connected');
    } else if (status === 'warning') {
      dotElement.classList.add('warning');
    }
  }

  // Utilities
  log(message, type = 'info') {
    const logsContainer = document.getElementById('logs');
    const timestamp = new Date().toLocaleTimeString();
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type} fade-in`;
    logEntry.innerHTML = `
      <span class="log-timestamp">[${timestamp}]</span> ${message}
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
    
    if (loading) {
      executeBtn.disabled = true;
      executeBtn.innerHTML = '<div class="spinner"></div> Executando...';
    } else {
      executeBtn.disabled = false;
      executeBtn.innerHTML = '🚀 Executar Sessão';
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.log('📋 Copiado para a área de transferência!', 'success');
    } catch (error) {
      this.log('❌ Erro ao copiar', 'error');
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
        this.log(`✅ ${result.message}`, 'success');
        if (result.pageInfo) {
          this.log(`📍 ${result.pageInfo.title} - ${result.pageInfo.url}`, 'info');
        }
      } else {
        this.log(`❌ ${result.error}`, 'error');
      }

    } catch (error) {
      this.log(`❌ Erro na execução: ${error.message}`, 'error');
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
        document.getElementById('generated-code').textContent = result.code;
        this.switchTab('code');
        this.log('📝 Código gerado com sucesso!', 'success');
      } else {
        this.log(`❌ Erro ao gerar código: ${result.error}`, 'error');
      }

    } catch (error) {
      this.log(`❌ Erro: ${error.message}`, 'error');
    }
  }

  // Config Management
  getConfigFromForm() {
    const config = {};

    const slowMo = parseInt(document.getElementById('slowMo').value);
    if (slowMo > 0) config.slowMo = slowMo;

    const timeout = parseInt(document.getElementById('timeout').value);
    if (timeout > 0) config.timeout = timeout;

    const userAgent = document.getElementById('userAgent').value.trim();
    if (userAgent) config.userAgent = userAgent;

    const userDataDir = document.getElementById('userDataDir').value.trim();
    if (userDataDir) config.userDataDir = userDataDir;

    const initialUrl = document.getElementById('initialUrl').value.trim();
    if (initialUrl) config.initialUrl = initialUrl;

    try {
      const cookies = document.getElementById('cookies').value.trim();
      if (cookies) {
        config.cookies = JSON.parse(cookies);
      }
    } catch (error) {
      this.log('⚠️ Erro no JSON de cookies', 'warning');
    }

    const sessionData = {};
    
    try {
      const localStorage = document.getElementById('localStorage').value.trim();
      if (localStorage) {
        sessionData.localStorage = JSON.parse(localStorage);
      }
    } catch (error) {
      this.log('⚠️ Erro no JSON do localStorage', 'warning');
    }

    try {
      const sessionStorage = document.getElementById('sessionStorage').value.trim();
      if (sessionStorage) {
        sessionData.sessionStorage = JSON.parse(sessionStorage);
      }
    } catch (error) {
      this.log('⚠️ Erro no JSON do sessionStorage', 'warning');
    }

    if (Object.keys(sessionData).length > 0) {
      config.sessionData = sessionData;
    }

    const blockedResourcesTypes = document.getElementById('blockedResourcesTypes').value.trim();
    if (blockedResourcesTypes) {
      config.blockedResourcesTypes = blockedResourcesTypes.split(',').map(s => s.trim());
    }

    const waitUntil = document.getElementById('waitUntil').value;
    if (waitUntil !== 'domcontentloaded') {
      config.navigationOptions = { waitUntil };
    }

    return config;
  }

  validateConfig(config) {
    if (!config.userDataDir) {
      this.log('⚠️ Diretório da sessão é obrigatório', 'warning');
      return false;
    }

    if (config.initialUrl && !this.isValidUrl(config.initialUrl)) {
      this.log('⚠️ URL inicial inválida', 'warning');
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
        name: '🌐 Configuração Básica',
        config: {
          slowMo: 1000,
          timeout: 60,
          userDataDir: 'sessao-basica',
          initialUrl: 'https://example.com'
        }
      },
      ecommerce: {
        name: '🛒 E-commerce',
        config: {
          slowMo: 500,
          timeout: 90,
          userDataDir: 'sessao-ecommerce',
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
          userDataDir: 'sessao-social',
          initialUrl: 'https://twitter.com/login',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
        }
      },
      scraping: {
        name: '🔍 Web Scraping',
        config: {
          slowMo: 200,
          timeout: 45,
          userDataDir: 'sessao-scraping',
          blockedResourcesTypes: ['image', 'stylesheet', 'font'],
          navigationOptions: { waitUntil: 'networkidle0' }
        }
      }
    };
  }

  applyTemplate(templateName) {
    const template = this.templates[templateName];
    if (!template) return;

    this.log(`📋 Aplicando template: ${template.name}`, 'info');
    this.setConfigToForm(template.config);
  }

  setConfigToForm(config) {
    if (config.slowMo) document.getElementById('slowMo').value = config.slowMo;
    if (config.timeout) document.getElementById('timeout').value = config.timeout;
    if (config.userAgent) document.getElementById('userAgent').value = config.userAgent;
    if (config.userDataDir) document.getElementById('userDataDir').value = config.userDataDir;
    if (config.initialUrl) document.getElementById('initialUrl').value = config.initialUrl;

    if (config.cookies) {
      document.getElementById('cookies').value = JSON.stringify(config.cookies, null, 2);
    }

    if (config.sessionData?.localStorage) {
      document.getElementById('localStorage').value = JSON.stringify(config.sessionData.localStorage, null, 2);
    }

    if (config.sessionData?.sessionStorage) {
      document.getElementById('sessionStorage').value = JSON.stringify(config.sessionData.sessionStorage, null, 2);
    }

    if (config.blockedResourcesTypes) {
      document.getElementById('blockedResourcesTypes').value = config.blockedResourcesTypes.join(', ');
    }

    if (config.navigationOptions?.waitUntil) {
      document.getElementById('waitUntil').value = config.navigationOptions.waitUntil;
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
  new PlaygroundApp();
});