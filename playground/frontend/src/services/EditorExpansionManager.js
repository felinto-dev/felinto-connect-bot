/**
 * EditorExpansionManager - Gerencia a funcionalidade de expansão/recolhimento de editores
 * 
 * Segue princípios SOLID:
 * - Single Responsibility: Apenas gerencia expansão de editores
 * - Open/Closed: Extensível para novos tipos de editores
 * - Liskov Substitution: Diferentes estratégias de editores são intercambiáveis
 * - Interface Segregation: Interfaces específicas para cada tipo de editor
 * - Dependency Inversion: Depende de abstrações, não implementações concretas
 */

export class EditorExpansionManager {
  constructor() {
    this.expandedEditors = new Set();
    this.editorStrategies = new Map();
    this.overlay = null;
    this.keyboardHandler = null;
    
    this.init();
  }

  init() {
    this.createOverlay();
    this.setupKeyboardHandlers();
  }

  /**
   * Registra uma estratégia para um tipo específico de editor
   * @param {string} editorType - Tipo do editor (sessionData, automation, footer, etc.)
   * @param {EditorStrategy} strategy - Estratégia específica do editor
   */
  registerEditorStrategy(editorType, strategy) {
    this.editorStrategies.set(editorType, strategy);
  }

  /**
   * Configura um editor para expansão
   * @param {string} editorId - ID único do editor
   * @param {string} editorType - Tipo do editor
   * @param {Object} config - Configurações específicas do editor
   */
  setupEditor(editorId, editorType, config = {}) {
    const strategy = this.editorStrategies.get(editorType);
    if (!strategy) {
      console.warn(`Estratégia não encontrada para o tipo de editor: ${editorType}`);
      return;
    }

    const editorConfig = {
      id: editorId,
      type: editorType,
      container: config.container,
      toggleButton: config.toggleButton,
      codeMirrorInstance: config.codeMirrorInstance,
      storageKey: `${editorId}Expanded`,
      ...config
    };

    strategy.setup(editorConfig, this);
    this.loadSavedState(editorConfig);
  }

  /**
   * Alterna o estado de expansão de um editor
   * @param {string} editorId - ID do editor
   * @param {boolean|null} forceState - Força um estado específico (true/false) ou null para toggle
   */
  toggleEditor(editorId, forceState = null) {
    const isCurrentlyExpanded = this.expandedEditors.has(editorId);
    const shouldExpand = forceState !== null ? forceState : !isCurrentlyExpanded;

    if (shouldExpand) {
      this.expandEditor(editorId);
    } else {
      this.collapseEditor(editorId);
    }
  }

  /**
   * Expande um editor específico
   * @param {string} editorId - ID do editor
   */
  expandEditor(editorId) {
    // Colapsar outros editores expandidos (apenas um por vez)
    this.collapseAllEditors();

    const strategy = this.getStrategyForEditor(editorId);
    if (!strategy) return;

    strategy.expand(editorId);
    this.expandedEditors.add(editorId);
    this.showOverlay();
    this.saveState(editorId, true);
    
    // Bloquear scroll da página
    document.body.style.overflow = 'hidden';
  }

  /**
   * Recolhe um editor específico
   * @param {string} editorId - ID do editor
   */
  collapseEditor(editorId) {
    const strategy = this.getStrategyForEditor(editorId);
    if (!strategy) return;

    strategy.collapse(editorId);
    this.expandedEditors.delete(editorId);
    this.hideOverlay();
    this.saveState(editorId, false);
    
    // Restaurar scroll da página
    document.body.style.overflow = '';
  }

  /**
   * Recolhe todos os editores expandidos
   */
  collapseAllEditors() {
    const expandedIds = Array.from(this.expandedEditors);
    expandedIds.forEach(editorId => this.collapseEditor(editorId));
  }

  /**
   * Verifica se algum editor está expandido
   * @returns {boolean}
   */
  hasExpandedEditor() {
    return this.expandedEditors.size > 0;
  }

  /**
   * Obtém a estratégia para um editor específico
   * @param {string} editorId - ID do editor
   * @returns {EditorStrategy|null}
   */
  getStrategyForEditor(editorId) {
    // Inferir tipo do editor pelo ID
    const editorType = this.inferEditorType(editorId);
    return this.editorStrategies.get(editorType);
  }

  /**
   * Infere o tipo do editor baseado no ID
   * @param {string} editorId - ID do editor
   * @returns {string}
   */
  inferEditorType(editorId) {
    if (editorId.includes('sessionData')) return 'sessionData';
    if (editorId.includes('automation')) return 'automation';
    if (editorId.includes('footer')) return 'footer';
    if (editorId.includes('header')) return 'header';
    return 'generic';
  }

  /**
   * Cria o overlay para modo expandido
   */
  createOverlay() {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'editor-expansion-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      z-index: 999;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    `;
    
    document.body.appendChild(this.overlay);
    
    // Fechar ao clicar no overlay
    this.overlay.addEventListener('click', () => {
      this.collapseAllEditors();
    });
  }

  /**
   * Mostra o overlay
   */
  showOverlay() {
    if (!this.overlay) return;
    this.overlay.style.opacity = '1';
    this.overlay.style.visibility = 'visible';
  }

  /**
   * Esconde o overlay
   */
  hideOverlay() {
    if (!this.overlay) return;
    this.overlay.style.opacity = '0';
    this.overlay.style.visibility = 'hidden';
  }

  /**
   * Configura handlers de teclado globais
   */
  setupKeyboardHandlers() {
    this.keyboardHandler = (e) => {
      // ESC para fechar qualquer editor expandido
      if (e.key === 'Escape' && this.hasExpandedEditor()) {
        e.preventDefault();
        this.collapseAllEditors();
        return;
      }
      
      // Ctrl/Cmd + Shift + E para toggle do último editor focado
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        this.handleGlobalToggle();
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Manipula o toggle global quando não há contexto específico
   */
  handleGlobalToggle() {
    if (this.hasExpandedEditor()) {
      this.collapseAllEditors();
    } else {
      // Expandir o primeiro editor disponível (sessionData por padrão)
      const firstEditor = document.querySelector('[data-editor-id]');
      if (firstEditor) {
        const editorId = firstEditor.getAttribute('data-editor-id');
        this.expandEditor(editorId);
      }
    }
  }

  /**
   * Carrega o estado salvo de um editor
   * @param {Object} editorConfig - Configuração do editor
   */
  loadSavedState(editorConfig) {
    const isExpanded = localStorage.getItem(editorConfig.storageKey) === 'true';
    if (isExpanded) {
      // Delay para garantir que o DOM esteja pronto
      setTimeout(() => this.expandEditor(editorConfig.id), 100);
    }
  }

  /**
   * Salva o estado de um editor
   * @param {string} editorId - ID do editor
   * @param {boolean} isExpanded - Estado de expansão
   */
  saveState(editorId, isExpanded) {
    const editorType = this.inferEditorType(editorId);
    const storageKey = `${editorId}Expanded`;
    localStorage.setItem(storageKey, isExpanded.toString());
  }

  /**
   * Limpa recursos e remove listeners
   */
  destroy() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
    }
    
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    
    this.expandedEditors.clear();
    this.editorStrategies.clear();
  }
}

/**
 * Interface base para estratégias de editores
 */
export class EditorStrategy {
  /**
   * Configura um editor específico
   * @param {Object} config - Configuração do editor
   * @param {EditorExpansionManager} manager - Instância do gerenciador
   */
  setup(config, manager) {
    throw new Error('Método setup deve ser implementado pela estratégia concreta');
  }

  /**
   * Expande o editor
   * @param {string} editorId - ID do editor
   */
  expand(editorId) {
    throw new Error('Método expand deve ser implementado pela estratégia concreta');
  }

  /**
   * Recolhe o editor
   * @param {string} editorId - ID do editor
   */
  collapse(editorId) {
    throw new Error('Método collapse deve ser implementado pela estratégia concreta');
  }
}
