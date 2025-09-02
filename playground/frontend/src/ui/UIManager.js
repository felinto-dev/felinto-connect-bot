export default class UIManager {
  constructor(app) {
    this.app = app;
    this.extractionData = {
      hasData: false,
      timestamp: null,
      data: null
    };
  }

  log(message, type = 'info') {
    const logsContainer = document.getElementById('logs');
    if (!logsContainer) return;
    
    const timestamp = new Date().toLocaleTimeString();
    
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
      this.app.initializeIcons();
    }
  }

  setExecuteCodeLoading(loading) {
    const executeCodeBtn = document.getElementById('executeCodeBtn');
    if (!executeCodeBtn) return;
    
    if (loading) {
      executeCodeBtn.disabled = true;
      executeCodeBtn.innerHTML = '<div class="spinner"></div> Executando Automação...';
      executeCodeBtn.classList.add('loading');
    } else {
      executeCodeBtn.disabled = false;
      executeCodeBtn.innerHTML = '<i data-lucide="play"></i> Executar Automação';
      executeCodeBtn.classList.remove('loading');
      this.app.initializeIcons();
    }
  }

  updateSessionStatus() {
    const sessionToggleBtn = document.getElementById('sessionToggleBtn');
    const executeBtn = document.getElementById('executeCodeBtn');
    const screenshotBtn = document.getElementById('takeScreenshotBtn');

    if (this.app.currentSession.active) {
      sessionToggleBtn.className = 'btn btn-danger';
      sessionToggleBtn.title = 'Fechar sessão ativa';
      sessionToggleBtn.innerHTML = '<i data-lucide="x-circle"></i>Fechar Sessão';
      
      executeBtn.disabled = false;
      screenshotBtn.disabled = false;
      
    } else {
      sessionToggleBtn.className = 'btn btn-success';
      sessionToggleBtn.title = 'Criar nova sessão Puppeteer';
      sessionToggleBtn.innerHTML = '<i data-lucide="plus-circle"></i>Criar Sessão';
      
      executeBtn.disabled = true;
      screenshotBtn.disabled = true;
    }
    
    this.app.initializeIcons();
  }

  showResults(result) {
    this.updatePageInfo(result.pageInfo);
  }

  hideResults() {
    this.clearResultsContent();
  }

  clearResultsContent() {
    const screenshotContainer = document.getElementById('screenshotContainer');
    screenshotContainer.innerHTML = '<p class="empty-state">Nenhum screenshot capturado ainda</p>';
    
    if (!this.extractionData.hasData) {
      const dataContainer = document.getElementById('dataContainer');
      dataContainer.innerHTML = '<pre class="code-output"><code>// Dados extraídos aparecerão aqui...</code></pre>';
    }
    
    document.getElementById('currentUrl').textContent = '-';
    document.getElementById('currentTitle').textContent = '-';
    document.getElementById('lastUpdate').textContent = '-';
  }

  showScreenshot(screenshotDataUrl) {
    const screenshotContainer = document.getElementById('screenshotContainer');
    
    screenshotContainer.innerHTML = `
      <img src="${screenshotDataUrl}" alt="Screenshot da página" />
      <p style="margin-top: 10px; font-size: 12px; color: #a0aec0;">
        Screenshot capturado em ${new Date().toLocaleString()}
      </p>
    `;
    
    this.switchResultsTab('screenshot');
  }

  showExtractionData(data) {
    const dataContainer = document.getElementById('dataContainer');
    
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
    
    this.updateExtractionBadge();
  }

  updateExtractionBadge() {
    let badgeElement = document.getElementById('extractionBadge');
    
    if (this.extractionData.hasData && this.extractionData.timestamp) {
      const timeString = this.extractionData.timestamp.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      if (!badgeElement) {
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

  updatePageInfo(pageInfo) {
    if (!pageInfo) return;
    
    const currentUrl = document.getElementById('currentUrl');
    const currentTitle = document.getElementById('currentTitle');
    const lastUpdate = document.getElementById('lastUpdate');
    
    currentUrl.textContent = pageInfo.url || '-';
    currentTitle.textContent = pageInfo.title || '-';
    lastUpdate.textContent = pageInfo.timestamp ? new Date(pageInfo.timestamp).toLocaleString() : '-';
  }

  switchResultsTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
  }

  async openDocumentation() {
    const modal = document.getElementById('docsModal');
    const content = document.getElementById('docsContent');
    
    if (!modal || !content) return;
    
    modal.style.display = 'flex';
    
    content.innerHTML = `
      <div class="loading-spinner">
        <i data-lucide="loader-2"></i>
        Carregando documentação...
      </div>
    `;
    
    this.app.initializeIcons();
    
    try {
      const response = await fetch('/api/docs');
      const result = await response.json();
      
      if (response.ok) {
        content.innerHTML = result.content;
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
    
    this.app.initializeIcons();
  }

  closeDocumentation() {
    const modal = document.getElementById('docsModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  applyDocumentationStyling(container) {
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

    const codeElements = container.querySelectorAll('code');
    codeElements.forEach(code => {
      const text = code.textContent || code.innerText;
      if (text.startsWith('--')) {
        code.classList.add('command-flag');
      }
    });

    const listItems = container.querySelectorAll('li');
    listItems.forEach(li => {
      if (li.querySelector('code') || li.textContent.includes('→')) {
        li.style.paddingTop = '6px';
        li.style.paddingBottom = '6px';
      }
    });

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

  toggleAdvancedConfig() {
    const toggleBtn = document.getElementById('toggleAdvancedConfig');
    const content = document.getElementById('advancedConfigContent');
    const toggleIcon = toggleBtn.querySelector('.toggle-icon');
    
    if (!toggleBtn || !content || !toggleIcon) return;
    
    const isExpanded = !content.classList.contains('collapsed');
    
    if (isExpanded) {
      content.classList.add('collapsed');
      toggleBtn.classList.remove('expanded');
      toggleBtn.querySelector('.toggle-text').textContent = 'Mostrar Configurações';
    } else {
      content.classList.remove('collapsed');
      toggleBtn.classList.add('expanded');
      toggleBtn.querySelector('.toggle-text').textContent = 'Ocultar Configurações';
    }
    
    this.app.configService.saveAdvancedConfigState(!isExpanded);
    
    setTimeout(() => {
      this.app.initializeIcons();
    }, 100);
  }

  showButtonSuccess(button, originalContent) {
    button.classList.add('success');
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg><span>Conectado!</span>';
    
    setTimeout(() => {
      button.classList.remove('success');
      button.innerHTML = originalContent;
      this.app.initializeIcons();
    }, 3000);
  }

  showButtonError(button, originalContent, errorType = 'connection') {
    const defaultContent = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg><span>Validar conexão</span>';
    const contentToRestore = typeof originalContent === 'string' && originalContent.includes('svg') ? originalContent : defaultContent;
    
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
    
    button.classList.add('error');
    button.innerHTML = `${errorIcon}<span>${errorMessage}</span>`;
    
    setTimeout(() => {
      button.classList.remove('error');
      button.innerHTML = contentToRestore;
      this.app.initializeIcons();
    }, 2500);
  }

  showTemporaryFeedback(button, message, icon, isError = false, duration = 3000) {
    if (!button) return;
    const originalHTML = button.innerHTML;
    
    const feedbackClass = isError ? 'error' : 'success';
    button.classList.add(feedbackClass);
    
    button.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
    this.app.initializeIcons();

    setTimeout(() => {
      button.classList.remove(feedbackClass);
      button.innerHTML = originalHTML;
      this.app.initializeIcons();
    }, duration);
  }
}
