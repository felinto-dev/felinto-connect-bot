/**
 * Estratégias específicas para diferentes tipos de editores
 * Implementa o padrão Strategy para diferentes comportamentos de expansão
 */

import { EditorStrategy } from './EditorExpansionManager.js';

/**
 * Estratégia para editores CodeMirror (automation, footer, header)
 */
export class CodeMirrorEditorStrategy extends EditorStrategy {
  setup(config, manager) {
    this.setupToggleButton(config, manager);
    this.applyInitialStyles(config);
  }

  setupToggleButton(config, manager) {
    const button = config.toggleButton;
    if (!button) return;

    button.addEventListener('click', () => {
      manager.toggleEditor(config.id);
    });

    // Configurar tooltip inicial
    button.title = 'Expandir editor (Ctrl+Shift+E)';
  }

  applyInitialStyles(config) {
    const container = config.container;
    if (!container) return;

    // Aplicar estilos de limitação de altura
    container.style.maxHeight = 'min(300px, 40vh)';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    container.style.transition = 'all 0.3s ease';

    // Aplicar estilos ao CodeMirror interno
    const cmEditor = container.querySelector('.cm-editor');
    const cmScroller = container.querySelector('.cm-scroller');
    
    if (cmEditor) {
      cmEditor.style.maxHeight = 'min(300px, 40vh)';
    }
    
    if (cmScroller) {
      cmScroller.style.maxHeight = 'min(300px, 40vh)';
      cmScroller.style.overflowY = 'auto';
    }

    // Adicionar indicador de scroll
    this.addScrollIndicator(container);
  }

  addScrollIndicator(container) {
    // Criar indicador de scroll se não existir
    if (!container.querySelector('.scroll-indicator')) {
      const indicator = document.createElement('div');
      indicator.className = 'scroll-indicator';
      indicator.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 20px;
        background: linear-gradient(transparent, rgba(26, 32, 44, 0.8));
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      `;
      container.appendChild(indicator);
    }

    // Verificar se precisa mostrar indicador
    setTimeout(() => this.updateScrollIndicator(container), 100);
  }

  updateScrollIndicator(container) {
    const scroller = container.querySelector('.cm-scroller');
    const indicator = container.querySelector('.scroll-indicator');
    
    if (!scroller || !indicator) return;

    const hasScroll = scroller.scrollHeight > scroller.clientHeight;
    const isExpanded = container.classList.contains('expanded');
    
    if (hasScroll && !isExpanded) {
      indicator.style.opacity = '1';
    } else {
      indicator.style.opacity = '0';
    }
  }

  expand(editorId) {
    const container = document.querySelector(`[data-editor-id="${editorId}"]`);
    const button = document.querySelector(`[data-editor-toggle="${editorId}"]`);
    
    if (!container || !button) return;

    // Aplicar estilos de expansão
    container.classList.add('expanded');
    container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90vw;
      height: 80vh;
      z-index: 1000;
      background: #1a202c;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-height: none;
      overflow: visible;
      transition: all 0.3s ease;
    `;

    // Ajustar CodeMirror para expansão
    const cmEditor = container.querySelector('.cm-editor');
    const cmScroller = container.querySelector('.cm-scroller');
    
    if (cmEditor) {
      cmEditor.style.height = '100%';
      cmEditor.style.maxHeight = 'none';
    }
    
    if (cmScroller) {
      cmScroller.style.height = '100%';
      cmScroller.style.maxHeight = 'none';
    }

    // Atualizar botão
    this.updateButton(button, true);

    // Forçar redimensionamento do CodeMirror
    setTimeout(() => {
      const codeMirrorInstance = this.getCodeMirrorInstance(container);
      if (codeMirrorInstance) {
        codeMirrorInstance.requestMeasure();
      }
    }, 300);
  }

  collapse(editorId) {
    const container = document.querySelector(`[data-editor-id="${editorId}"]`);
    const button = document.querySelector(`[data-editor-toggle="${editorId}"]`);
    
    if (!container || !button) return;

    // Remover estilos de expansão
    container.classList.remove('expanded');
    container.style.cssText = `
      max-height: min(300px, 40vh);
      overflow: hidden;
      position: relative;
      transition: all 0.3s ease;
    `;

    // Restaurar CodeMirror para estado normal
    const cmEditor = container.querySelector('.cm-editor');
    const cmScroller = container.querySelector('.cm-scroller');
    
    if (cmEditor) {
      cmEditor.style.height = 'auto';
      cmEditor.style.maxHeight = 'min(300px, 40vh)';
    }
    
    if (cmScroller) {
      cmScroller.style.height = 'auto';
      cmScroller.style.maxHeight = 'min(300px, 40vh)';
      cmScroller.style.overflowY = 'auto';
    }

    // Atualizar botão
    this.updateButton(button, false);

    // Forçar redimensionamento e atualizar indicador
    setTimeout(() => {
      const codeMirrorInstance = this.getCodeMirrorInstance(container);
      if (codeMirrorInstance) {
        codeMirrorInstance.requestMeasure();
      }
      this.updateScrollIndicator(container);
    }, 300);
  }

  updateButton(button, isExpanded) {
    const textSpan = button.querySelector('.toggle-text');
    const iconSpan = button.querySelector('.toggle-icon');
    
    if (isExpanded) {
      button.classList.add('expanded');
      if (textSpan) textSpan.textContent = 'recolher';
      button.title = 'Recolher editor (ESC ou Ctrl+Shift+E)';
    } else {
      button.classList.remove('expanded');
      if (textSpan) textSpan.textContent = 'expandir';
      button.title = 'Expandir editor (Ctrl+Shift+E)';
    }
  }

  getCodeMirrorInstance(container) {
    // Tentar encontrar a instância do CodeMirror
    const cmElement = container.querySelector('.cm-editor');
    return cmElement?.cmView?.view || null;
  }
}

/**
 * Estratégia para o editor de Session Data (JSON)
 * Herda de CodeMirrorEditorStrategy mas com comportamentos específicos para JSON
 */
export class SessionDataEditorStrategy extends CodeMirrorEditorStrategy {
  setup(config, manager) {
    super.setup(config, manager);
    
    // Configurações específicas para JSON
    this.setupJsonSpecificFeatures(config);
  }

  setupJsonSpecificFeatures(config) {
    const container = config.container;
    if (!container) return;

    // Adicionar listener para mudanças no conteúdo JSON
    const codeMirrorInstance = config.codeMirrorInstance;
    if (codeMirrorInstance) {
      // Listener já existe no EditorManager original
      // Apenas garantir que o indicador de scroll seja atualizado
      setTimeout(() => this.updateScrollIndicator(container), 500);
    }
  }

  // Override dos métodos expand e collapse para usar seletor consistente
  expand(editorId) {
    // Usar o seletor correto para sessionData
    const container = document.querySelector(`[data-editor-id="${editorId}"]`);
    const button = document.querySelector(`[data-editor-toggle="${editorId}"]`);
    
    if (!container || !button) return;

    // Aplicar estilos de expansão
    container.classList.add('expanded');
    container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90vw;
      height: 80vh;
      z-index: 1000;
      background: #1a202c;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-height: none;
      overflow: visible;
      transition: all 0.3s ease;
    `;

    // Ajustar CodeMirror para expansão
    const cmEditor = container.querySelector('.cm-editor');
    const cmScroller = container.querySelector('.cm-scroller');
    
    if (cmEditor) {
      cmEditor.style.height = '100%';
      cmEditor.style.maxHeight = 'none';
    }
    
    if (cmScroller) {
      cmScroller.style.height = '100%';
      cmScroller.style.maxHeight = 'none';
    }

    // Atualizar botão
    this.updateButton(button, true);

    // Forçar redimensionamento do CodeMirror
    setTimeout(() => {
      const codeMirrorInstance = this.getCodeMirrorInstance(container);
      if (codeMirrorInstance) {
        codeMirrorInstance.requestMeasure();
      }
    }, 300);
  }

  collapse(editorId) {
    // Usar o seletor correto para sessionData
    const container = document.querySelector(`[data-editor-id="${editorId}"]`);
    const button = document.querySelector(`[data-editor-toggle="${editorId}"]`);
    
    if (!container || !button) return;

    // Remover estilos de expansão
    container.classList.remove('expanded');
    container.style.cssText = `
      max-height: min(300px, 40vh);
      overflow: hidden;
      position: relative;
      transition: all 0.3s ease;
      border: 1px solid #333;
      border-radius: 4px;
    `;

    // Restaurar CodeMirror para estado normal
    const cmEditor = container.querySelector('.cm-editor');
    const cmScroller = container.querySelector('.cm-scroller');
    
    if (cmEditor) {
      cmEditor.style.height = 'auto';
      cmEditor.style.maxHeight = 'min(300px, 40vh)';
    }
    
    if (cmScroller) {
      cmScroller.style.height = 'auto';
      cmScroller.style.maxHeight = 'min(300px, 40vh)';
      cmScroller.style.overflowY = 'auto';
    }

    // Garantir que o textarea original permaneça oculto
    const textarea = document.getElementById('sessionData');
    if (textarea) {
      textarea.style.display = 'none';
    }

    // Atualizar botão
    this.updateButton(button, false);

    // Forçar redimensionamento e atualizar indicador
    setTimeout(() => {
      const codeMirrorInstance = this.getCodeMirrorInstance(container);
      if (codeMirrorInstance) {
        codeMirrorInstance.requestMeasure();
      }
      this.updateScrollIndicator(container);
    }, 300);
  }
}

/**
 * Estratégia para editores de código gerado (read-only)
 */
export class GeneratedCodeEditorStrategy extends EditorStrategy {
  setup(config, manager) {
    this.setupToggleButton(config, manager);
    this.applyInitialStyles(config);
  }

  setupToggleButton(config, manager) {
    const button = config.toggleButton;
    if (!button) return;

    button.addEventListener('click', () => {
      manager.toggleEditor(config.id);
    });

    button.title = 'Expandir código (Ctrl+Shift+E)';
  }

  applyInitialStyles(config) {
    const container = config.container;
    if (!container) return;

    container.style.maxHeight = 'min(400px, 50vh)';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    container.style.transition = 'all 0.3s ease';

    // Para código gerado, usar scroll no container principal
    const codeContent = container.querySelector('pre, code, .code-output');
    if (codeContent) {
      codeContent.style.maxHeight = 'min(400px, 50vh)';
      codeContent.style.overflowY = 'auto';
    }

    this.addScrollIndicator(container);
  }

  addScrollIndicator(container) {
    if (!container.querySelector('.scroll-indicator')) {
      const indicator = document.createElement('div');
      indicator.className = 'scroll-indicator';
      indicator.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 20px;
        background: linear-gradient(transparent, rgba(26, 32, 44, 0.8));
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      `;
      container.appendChild(indicator);
    }

    setTimeout(() => this.updateScrollIndicator(container), 100);
  }

  updateScrollIndicator(container) {
    const codeContent = container.querySelector('pre, code, .code-output');
    const indicator = container.querySelector('.scroll-indicator');
    
    if (!codeContent || !indicator) return;

    const hasScroll = codeContent.scrollHeight > codeContent.clientHeight;
    const isExpanded = container.classList.contains('expanded');
    
    if (hasScroll && !isExpanded) {
      indicator.style.opacity = '1';
    } else {
      indicator.style.opacity = '0';
    }
  }

  expand(editorId) {
    const container = document.querySelector(`[data-editor-id="${editorId}"]`);
    const button = document.querySelector(`[data-editor-toggle="${editorId}"]`);
    
    if (!container || !button) return;

    container.classList.add('expanded');
    container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90vw;
      height: 80vh;
      z-index: 1000;
      background: #1a202c;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-height: none;
      overflow: visible;
      transition: all 0.3s ease;
    `;

    const codeContent = container.querySelector('pre, code, .code-output');
    if (codeContent) {
      codeContent.style.height = '100%';
      codeContent.style.maxHeight = 'none';
      codeContent.style.overflow = 'auto';
    }

    this.updateButton(button, true);
  }

  collapse(editorId) {
    const container = document.querySelector(`[data-editor-id="${editorId}"]`);
    const button = document.querySelector(`[data-editor-toggle="${editorId}"]`);
    
    if (!container || !button) return;

    container.classList.remove('expanded');
    container.style.cssText = `
      max-height: min(400px, 50vh);
      overflow: hidden;
      position: relative;
      transition: all 0.3s ease;
    `;

    const codeContent = container.querySelector('pre, code, .code-output');
    if (codeContent) {
      codeContent.style.height = 'auto';
      codeContent.style.maxHeight = 'min(400px, 50vh)';
      codeContent.style.overflowY = 'auto';
    }

    this.updateButton(button, false);
    
    setTimeout(() => this.updateScrollIndicator(container), 300);
  }

  updateButton(button, isExpanded) {
    const textSpan = button.querySelector('.toggle-text');
    
    if (isExpanded) {
      button.classList.add('expanded');
      if (textSpan) textSpan.textContent = 'recolher';
      button.title = 'Recolher código (ESC ou Ctrl+Shift+E)';
    } else {
      button.classList.remove('expanded');
      if (textSpan) textSpan.textContent = 'expandir';
      button.title = 'Expandir código (Ctrl+Shift+E)';
    }
  }
}
