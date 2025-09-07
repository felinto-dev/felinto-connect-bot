import { LogType } from "../types/common";
import { PageInfo } from "../types/api";
import { ExecuteCodeResponse } from "../types/api";
import { truncateUrl } from "../utils/recording";

interface ExtractionData {
  hasData: boolean;
  timestamp: Date | null;
  data: any;
}

export default class UIManager {
  private app: any;
  private extractionData: ExtractionData;

  constructor(app: any) {
    this.app = app;
    this.extractionData = {
      hasData: false,
      timestamp: null,
      data: null
    };
  }

  log(message: string, type: LogType = 'info'): void {
    const logsContainer = document.getElementById('logs');
    if (!logsContainer) return;
    
    const timestamp = new Date().toLocaleTimeString();
    
    const typeLabels: Record<LogType, string> = {
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

    if (logsContainer.children.length > 100) {
      logsContainer.removeChild(logsContainer.children[0]);
    }
  }

  setLoading(loading: boolean): void {
    const executeBtn = document.getElementById('executeBtn') as HTMLButtonElement;
    if (!executeBtn) return;
    
    executeBtn.disabled = loading;
    if (loading) {
      executeBtn.innerHTML = '<div class="spinner"></div> Executando...';
    } else {
      executeBtn.innerHTML = '<i data-lucide="play"></i> Executar';
      this.app.initializeIcons();
    }
  }

  setExecuteCodeLoading(loading: boolean): void {
    const executeCodeBtn = document.getElementById('executeCodeBtn') as HTMLButtonElement;
    if (!executeCodeBtn) return;
    
    executeCodeBtn.disabled = loading;
    executeCodeBtn.classList.toggle('loading', loading);
    if (loading) {
      executeCodeBtn.innerHTML = '<div class="spinner"></div> Executando Automação...';
    } else {
      executeCodeBtn.innerHTML = '<i data-lucide="play"></i> Executar Automação';
      this.app.initializeIcons();
    }
  }

  setExecuteExtractionLoading(loading: boolean): void {
    const executeExtractionBtn = document.getElementById('executeExtractionBtn') as HTMLButtonElement;
    if (!executeExtractionBtn) return;
    
    executeExtractionBtn.disabled = loading;
    executeExtractionBtn.classList.toggle('loading', loading);
    if (loading) {
      executeExtractionBtn.innerHTML = '<div class="spinner"></div> Executando Extração...';
    } else {
      executeExtractionBtn.innerHTML = '<i data-lucide="database"></i> Executar Extração';
      this.app.initializeIcons();
    }
  }

  setSessionLoading(loading: boolean): void {
    const sessionToggleBtn = document.getElementById('sessionToggleBtn') as HTMLButtonElement;
    if (!sessionToggleBtn) return;
    
    const isActive = this.app.currentSession.active;
    
    sessionToggleBtn.disabled = loading;
    sessionToggleBtn.classList.toggle('loading', loading);
    if (loading) {
      if (isActive) {
        sessionToggleBtn.innerHTML = '<div class="spinner"></div> Fechando...';
      } else {
        sessionToggleBtn.innerHTML = '<div class="spinner"></div> Criando...';
      }
    } else {
      // Restaura o estado normal do botão
      this.updateSessionStatus();
    }
  }

  updateSessionStatus(): void {
    const sessionToggleBtn = document.getElementById('sessionToggleBtn') as HTMLButtonElement;
    const executeBtn = document.getElementById('executeCodeBtn') as HTMLButtonElement;
    const executeExtractionBtn = document.getElementById('executeExtractionBtn') as HTMLButtonElement;
    const screenshotBtn = document.getElementById('takeScreenshotBtn') as HTMLButtonElement;

    if (!sessionToggleBtn) return;

    const isActive = this.app.currentSession.active;
    
    sessionToggleBtn.className = `btn ${isActive ? 'btn-danger' : 'btn-success'}`;
    sessionToggleBtn.title = isActive ? 'Fechar sessão ativa' : 'Criar nova sessão Puppeteer';
    sessionToggleBtn.innerHTML = isActive 
      ? '<i data-lucide="x-circle"></i>Fechar Sessão' 
      : '<i data-lucide="plus-circle"></i>Criar Sessão';
      
    if (executeBtn) executeBtn.disabled = !isActive;
    if (executeExtractionBtn) executeExtractionBtn.disabled = !isActive;
    if (screenshotBtn) screenshotBtn.disabled = !isActive;
    
    this.app.initializeIcons();
  }

  showResults(result: ExecuteCodeResponse): void {
    if (result.pageInfo) {
      this.updatePageInfo(result.pageInfo);
    }
  }

  hideResults(): void {
    this.clearResultsContent();
  }

  clearResultsContent(): void {
    const screenshotContainer = document.getElementById('screenshotContainer');
    if (screenshotContainer) {
      screenshotContainer.innerHTML = '<p class="empty-state">Nenhum screenshot capturado ainda</p>';
    }
    
    if (!this.extractionData.hasData) {
      const dataContainer = document.getElementById('dataContainer');
      if (dataContainer) {
        dataContainer.innerHTML = '<pre class="code-output"><code>// Dados extraídos aparecerão aqui...</code></pre>';
      }
    }
    
    const currentUrl = document.getElementById('currentUrl');
    if (currentUrl) currentUrl.textContent = '-';
    const currentTitle = document.getElementById('currentTitle');
    if (currentTitle) currentTitle.textContent = '-';
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) lastUpdate.textContent = '-';
  }

  showScreenshot(screenshotDataUrl: string): void {
    const screenshotContainer = document.getElementById('screenshotContainer');
    if (!screenshotContainer) return;
    
    screenshotContainer.innerHTML = `
      <img src="${screenshotDataUrl}" alt="Screenshot da página" />
      <p style="margin-top: 10px; font-size: 12px; color: #a0aec0;">
        Screenshot capturado em ${new Date().toLocaleString()}
      </p>
    `;
    
    this.switchResultsTab('screenshot');
  }

  showExtractionData(data: any): void {
    const dataContainer = document.getElementById('dataContainer');
    if (!dataContainer) return;
    
    this.extractionData = {
      hasData: true,
      timestamp: new Date(),
      data: data
    };
    
    let displayData: string;
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

  updateExtractionBadge(): void {
    let badgeElement = document.getElementById('extractionBadge');
    
    if (this.extractionData.hasData && this.extractionData.timestamp) {
      const timeString = this.extractionData.timestamp.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      if (!badgeElement) {
        const resultsTitle = document.querySelector<HTMLElement>('#resultsSection h3');
        if (!resultsTitle) return;
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

  updatePageInfo(pageInfo: PageInfo): void {
    const currentUrl = document.getElementById('currentUrl');
    const currentTitle = document.getElementById('currentTitle');
    const lastUpdate = document.getElementById('lastUpdate');
    
    if (currentUrl) {
      const url = pageInfo.url || '-';
      // Truncar URL para evitar quebra de layout, mas manter URL completa no tooltip
      const truncatedUrl = url !== '-' ? truncateUrl(url, 50) : url;
      currentUrl.textContent = truncatedUrl;
      currentUrl.title = url; // URL completa no tooltip
    }
    if (currentTitle) currentTitle.textContent = pageInfo.title || '-';
    if (lastUpdate) lastUpdate.textContent = pageInfo.timestamp ? new Date(pageInfo.timestamp).toLocaleString() : '-';
  }

  switchResultsTab(tabName: 'screenshot' | 'data' | 'pageinfo'): void {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}Tab`)?.classList.add('active');
  }

  async openDocumentation(): Promise<void> {
    const modal = document.getElementById('docsModal') as HTMLElement;
    const content = document.getElementById('docsContent') as HTMLElement;
    
    if (!modal || !content) return;
    
    modal.style.display = 'flex';
    content.innerHTML = `<div class="loading-spinner"><i data-lucide="loader-2"></i>Carregando documentação...</div>`;
    this.app.initializeIcons();
    
    try {
      const response = await fetch('/api/docs');
      const result = await response.json();
      
      if (response.ok) {
        content.innerHTML = result.content;
        this.applyDocumentationStyling(content);
        this.log('📖 Documentação carregada com sucesso', 'info');
      } else {
        content.innerHTML = `<div class="error-message"><i data-lucide="alert-circle"></i><h3>Erro ao carregar documentação</h3><p>${result.error || 'Erro desconhecido'}</p></div>`;
        this.log(`❌ Erro ao carregar documentação: ${result.error}`, 'error');
      }
    } catch (error) {
      content.innerHTML = `<div class="error-message"><i data-lucide="wifi-off"></i><h3>Erro de conexão</h3><p>Não foi possível conectar ao servidor.</p><small>${(error as Error).message}</small></div>`;
      this.log(`❌ Erro de conexão ao carregar documentação: ${(error as Error).message}`, 'error');
    }
    
    this.app.initializeIcons();
  }

  closeDocumentation(): void {
    const modal = document.getElementById('docsModal') as HTMLElement;
    if (modal) modal.style.display = 'none';
  }

  applyDocumentationStyling(container: HTMLElement): void {
    container.querySelectorAll('h2, h3').forEach(header => {
      const text = header.textContent || '';
      if (text.includes('⚠️') || text.includes('IMPORTANTE')) header.classList.add('warning-section');
      else if (text.includes('🚀')) header.classList.add('info-section');
      else if (text.includes('🔧') || text.includes('🛠️')) header.classList.add('config-section');
    });

    container.querySelectorAll('code').forEach(code => {
      if (code.textContent?.startsWith('--')) code.classList.add('command-flag');
    });
  }

  toggleAdvancedConfig(): void {
    const toggleBtn = document.getElementById('toggleAdvancedConfig') as HTMLButtonElement;
    const content = document.getElementById('advancedConfigContent') as HTMLElement;
    
    if (!toggleBtn || !content) return;
    
    const isExpanded = !content.classList.contains('collapsed');
    content.classList.toggle('collapsed', isExpanded);
    toggleBtn.classList.toggle('expanded', !isExpanded);
    toggleBtn.querySelector('.toggle-text')!.textContent = isExpanded ? 'Mostrar Configurações' : 'Ocultar Configurações';
    
    this.app.configService.saveAdvancedConfigState(!isExpanded);
    setTimeout(() => this.app.initializeIcons(), 100);
  }

  showButtonSuccess(button: HTMLButtonElement, originalContent: string): void {
    button.classList.add('success');
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg><span>Conectado!</span>';
    
    setTimeout(() => {
      button.classList.remove('success');
      button.innerHTML = originalContent;
      this.app.initializeIcons();
    }, 3000);
  }

  showButtonError(button: HTMLButtonElement, originalContent: string, errorType: string = 'connection'): void {
    const defaultContent = '<span>Validar conexão</span>'; // Simplificado
    const contentToRestore = originalContent.includes('svg') ? originalContent : defaultContent;
    
    let errorMessage: string;
    
    switch (errorType) {
      case 'timeout': errorMessage = 'Timeout'; break;
      case 'http': errorMessage = 'Sem resposta'; break;
      default: errorMessage = 'Falha';
    }
    
    button.classList.add('error');
    button.innerHTML = `<span>${errorMessage}</span>`;
    
    setTimeout(() => {
      button.classList.remove('error');
      button.innerHTML = contentToRestore;
      this.app.initializeIcons();
    }, 2500);
  }

  showTemporaryFeedback(button: HTMLButtonElement, message: string, icon: string, isError: boolean = false, duration: number = 3000): void {
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

  toggleConfigSection(): void {
    const toggleBtn = document.getElementById('toggleConfigSection') as HTMLButtonElement;
    const content = document.getElementById('configSectionContent') as HTMLElement;
    if (!toggleBtn || !content) return;
    
    const isExpanded = !content.classList.contains('collapsed');
    content.classList.toggle('collapsed', isExpanded);
    toggleBtn.classList.toggle('collapsed', isExpanded);
    toggleBtn.querySelector('.toggle-text')!.textContent = isExpanded ? 'Expandir' : 'Recolher';
    localStorage.setItem('playground-config-section-collapsed', JSON.stringify(isExpanded));
    
    setTimeout(() => this.app.initializeIcons(), 100);
  }

  toggleExecutionSection(): void {
    const toggleBtn = document.getElementById('toggleExecutionSection') as HTMLButtonElement;
    const content = document.getElementById('executionSectionContent') as HTMLElement;
    if (!toggleBtn || !content) return;

    const isExpanded = !content.classList.contains('collapsed');
    content.classList.toggle('collapsed', isExpanded);
    toggleBtn.classList.toggle('collapsed', isExpanded);
    toggleBtn.querySelector('.toggle-text')!.textContent = isExpanded ? 'Expandir' : 'Recolher';
    localStorage.setItem('playground-execution-section-collapsed', JSON.stringify(isExpanded));
    
    setTimeout(() => this.app.initializeIcons(), 100);
  }
}
