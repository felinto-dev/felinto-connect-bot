import { EditorExpansionManager, EditorConfig, IEditorStrategy } from './EditorExpansionManager';
import { EditorView } from '@codemirror/view';

/**
 * Estratégia para editores CodeMirror (automation, footer, header)
 */
export class CodeMirrorEditorStrategy implements IEditorStrategy {
  setup(config: EditorConfig, manager: EditorExpansionManager): void {
    this.setupToggleButton(config, manager);
    this.applyInitialStyles(config);
  }

  protected setupToggleButton(config: EditorConfig, manager: EditorExpansionManager): void {
    const button = config.toggleButton;
    if (!button) return;

    button.addEventListener('click', () => {
      manager.toggleEditor(config.id);
    });

    button.title = 'Expandir editor (Ctrl+Shift+E)';
  }

  protected applyInitialStyles(config: EditorConfig): void {
    const container = config.container;
    if (!container) return;

    container.style.maxHeight = 'min(300px, 40vh)';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    container.style.transition = 'all 0.3s ease';

    const cmEditor = container.querySelector<HTMLElement>('.cm-editor');
    const cmScroller = container.querySelector<HTMLElement>('.cm-scroller');
    
    if (cmEditor) cmEditor.style.maxHeight = 'min(300px, 40vh)';
    if (cmScroller) {
      cmScroller.style.maxHeight = 'min(300px, 40vh)';
      cmScroller.style.overflowY = 'auto';
    }

    this.addScrollIndicator(container);
  }

  protected addScrollIndicator(container: HTMLElement): void {
    if (!container.querySelector('.scroll-indicator')) {
      const indicator = document.createElement('div');
      indicator.className = 'scroll-indicator';
      indicator.style.cssText = `
        position: absolute; bottom: 0; left: 0; right: 0; height: 20px;
        background: linear-gradient(transparent, rgba(26, 32, 44, 0.8));
        pointer-events: none; opacity: 0; transition: opacity 0.2s ease;
      `;
      container.appendChild(indicator);
    }
    setTimeout(() => this.updateScrollIndicator(container), 100);
  }

  protected updateScrollIndicator(container: HTMLElement): void {
    const scroller = container.querySelector<HTMLElement>('.cm-scroller');
    const indicator = container.querySelector<HTMLElement>('.scroll-indicator');
    
    if (!scroller || !indicator) return;

    const hasScroll = scroller.scrollHeight > scroller.clientHeight;
    const isExpanded = container.classList.contains('expanded');
    
    indicator.style.opacity = (hasScroll && !isExpanded) ? '1' : '0';
  }

  expand(editorId: string): void {
    const container = document.querySelector<HTMLElement>(`[data-editor-id="${editorId}"]`);
    const button = document.querySelector<HTMLButtonElement>(`[data-editor-toggle="${editorId}"]`);
    
    if (!container || !button) return;

    container.classList.add('expanded');
    container.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%); width: 90vw; height: 80vh;
      z-index: 1000; background: #1a202c; border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-height: none; overflow: visible; transition: all 0.3s ease;
    `;

    const cmEditor = container.querySelector<HTMLElement>('.cm-editor');
    const cmScroller = container.querySelector<HTMLElement>('.cm-scroller');
    
    if (cmEditor) {
      cmEditor.style.height = '100%';
      cmEditor.style.maxHeight = 'none';
    }
    if (cmScroller) {
      cmScroller.style.height = '100%';
      cmScroller.style.maxHeight = 'none';
    }

    this.updateButton(button, true);

    setTimeout(() => {
      this.getCodeMirrorInstance(container)?.requestMeasure();
    }, 300);
  }

  collapse(editorId: string): void {
    const container = document.querySelector<HTMLElement>(`[data-editor-id="${editorId}"]`);
    const button = document.querySelector<HTMLButtonElement>(`[data-editor-toggle="${editorId}"]`);
    
    if (!container || !button) return;

    container.classList.remove('expanded');
    container.style.cssText = `
      max-height: min(300px, 40vh); overflow: hidden;
      position: relative; transition: all 0.3s ease;
    `;

    const cmEditor = container.querySelector<HTMLElement>('.cm-editor');
    const cmScroller = container.querySelector<HTMLElement>('.cm-scroller');
    
    if (cmEditor) {
      cmEditor.style.height = 'auto';
      cmEditor.style.maxHeight = 'min(300px, 40vh)';
    }
    if (cmScroller) {
      cmScroller.style.height = 'auto';
      cmScroller.style.maxHeight = 'min(300px, 40vh)';
      cmScroller.style.overflowY = 'auto';
    }

    this.updateButton(button, false);

    setTimeout(() => {
      this.getCodeMirrorInstance(container)?.requestMeasure();
      this.updateScrollIndicator(container);
    }, 300);
  }

  protected updateButton(button: HTMLButtonElement, isExpanded: boolean): void {
    const textSpan = button.querySelector<HTMLSpanElement>('.toggle-text');
    
    button.classList.toggle('expanded', isExpanded);
    if (textSpan) textSpan.textContent = isExpanded ? 'recolher' : 'expandir';
    button.title = isExpanded 
      ? 'Recolher editor (ESC ou Ctrl+Shift+E)' 
      : 'Expandir editor (Ctrl+Shift+E)';
  }

  protected getCodeMirrorInstance(container: HTMLElement): EditorView | null {
    const cmElement = container.querySelector<any>('.cm-editor');
    return cmElement?.cmView?.view || null;
  }
}

/**
 * Estratégia para o editor de Session Data (JSON)
 */
export class SessionDataEditorStrategy extends CodeMirrorEditorStrategy {
  setup(config: EditorConfig, manager: EditorExpansionManager): void {
    super.setup(config, manager);
    this.setupJsonSpecificFeatures(config);
  }

  private setupJsonSpecificFeatures(config: EditorConfig): void {
    const container = config.container;
    if (!container) return;
    if (config.codeMirrorInstance) {
      setTimeout(() => this.updateScrollIndicator(container), 500);
    }
  }

  collapse(editorId: string): void {
    const container = document.querySelector<HTMLElement>(`[data-editor-id="${editorId}"]`);
    const button = document.querySelector<HTMLButtonElement>(`[data-editor-toggle="${editorId}"]`);
    
    if (!container || !button) return;

    container.classList.remove('expanded');
    container.style.cssText = `
      max-height: min(300px, 40vh); overflow: hidden; position: relative;
      transition: all 0.3s ease; border: 1px solid #333; border-radius: 4px;
    `;

    const cmEditor = container.querySelector<HTMLElement>('.cm-editor');
    const cmScroller = container.querySelector<HTMLElement>('.cm-scroller');
    
    if (cmEditor) {
      cmEditor.style.height = 'auto';
      cmEditor.style.maxHeight = 'min(300px, 40vh)';
    }
    if (cmScroller) {
      cmScroller.style.height = 'auto';
      cmScroller.style.maxHeight = 'min(300px, 40vh)';
      cmScroller.style.overflowY = 'auto';
    }

    this.updateButton(button, false);

    setTimeout(() => {
      this.getCodeMirrorInstance(container)?.requestMeasure();
      this.updateScrollIndicator(container);
    }, 300);
  }
}
