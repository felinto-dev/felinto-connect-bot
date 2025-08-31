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

    this.setupAutoSave();
    this.setupModalEventListeners();
  }

  setupAutoSave() {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.saveConfig();
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

  // Import/Export Configuration
  async exportConfig() {
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
    } catch (error) {
      this.log(`❌ Erro ao exportar configurações: ${error.message}`, 'error');
    }
  }

  async importConfig() {
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
        
      case 'ipad':
        userAgent = 'Mozilla/5.0 (iPad; CPU OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
        this.log('🔷 Aplicado User Agent: iPad', 'info');
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