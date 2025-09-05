import { EditorView } from "@codemirror/view";

// Tipos para configuração de editor
export type EditorType = 'sessionData' | 'automation' | 'footer' | 'header' | 'generic';

export interface EditorConfig {
  id: string;
  type: EditorType;
  container: HTMLElement;
  toggleButton: HTMLButtonElement;
  codeMirrorInstance?: EditorView;
  storageKey: string;
}

// Interface para as estratégias de editor
export interface IEditorStrategy {
  setup(config: EditorConfig, manager: EditorExpansionManager): void;
  expand(editorId: string): void;
  collapse(editorId: string): void;
}

export class EditorExpansionManager {
  private expandedEditors: Set<string>;
  private editorStrategies: Map<EditorType, IEditorStrategy>;
  private overlay: HTMLElement | null;
  private keyboardHandler: ((e: KeyboardEvent) => void) | null;

  constructor() {
    this.expandedEditors = new Set();
    this.editorStrategies = new Map();
    this.overlay = null;
    this.keyboardHandler = null;
    
    this.init();
  }

  init(): void {
    this.createOverlay();
    this.setupKeyboardHandlers();
  }

  registerEditorStrategy(editorType: EditorType, strategy: IEditorStrategy): void {
    this.editorStrategies.set(editorType, strategy);
  }

  setupEditor(editorId: string, editorType: EditorType, config: Partial<EditorConfig> = {}): void {
    const strategy = this.editorStrategies.get(editorType);
    if (!strategy) {
      console.warn(`Estratégia não encontrada para o tipo de editor: ${editorType}`);
      return;
    }

    const editorConfig: EditorConfig = {
      id: editorId,
      type: editorType,
      container: config.container!,
      toggleButton: config.toggleButton!,
      codeMirrorInstance: config.codeMirrorInstance,
      storageKey: `${editorId}Expanded`,
      ...config
    };

    strategy.setup(editorConfig, this);
    this.loadSavedState(editorConfig);
  }

  toggleEditor(editorId: string, forceState: boolean | null = null): void {
    const isCurrentlyExpanded = this.expandedEditors.has(editorId);
    const shouldExpand = forceState !== null ? forceState : !isCurrentlyExpanded;

    if (shouldExpand) {
      this.expandEditor(editorId);
    } else {
      this.collapseEditor(editorId);
    }
  }

  expandEditor(editorId: string): void {
    this.collapseAllEditors();

    const strategy = this.getStrategyForEditor(editorId);
    if (!strategy) return;

    strategy.expand(editorId);
    this.expandedEditors.add(editorId);
    this.showOverlay();
    this.saveState(editorId, true);
    
    document.body.style.overflow = 'hidden';
  }

  collapseEditor(editorId: string): void {
    const strategy = this.getStrategyForEditor(editorId);
    if (!strategy) return;

    strategy.collapse(editorId);
    this.expandedEditors.delete(editorId);
    this.hideOverlay();
    this.saveState(editorId, false);
    
    document.body.style.overflow = '';
  }

  collapseAllEditors(): void {
    const expandedIds = Array.from(this.expandedEditors);
    expandedIds.forEach(editorId => this.collapseEditor(editorId));
  }

  hasExpandedEditor(): boolean {
    return this.expandedEditors.size > 0;
  }

  private getStrategyForEditor(editorId: string): IEditorStrategy | undefined {
    const editorType = this.inferEditorType(editorId);
    return this.editorStrategies.get(editorType);
  }

  private inferEditorType(editorId: string): EditorType {
    if (editorId.includes('sessionData')) return 'sessionData';
    if (editorId.includes('automation')) return 'automation';
    if (editorId.includes('footer')) return 'footer';
    if (editorId.includes('header')) return 'header';
    return 'generic';
  }

  private createOverlay(): void {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'editor-expansion-overlay';
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.7); z-index: 999; opacity: 0;
      visibility: hidden; transition: all 0.3s ease;
    `;
    
    document.body.appendChild(this.overlay);
    
    this.overlay.addEventListener('click', () => {
      this.collapseAllEditors();
    });
  }

  private showOverlay(): void {
    if (!this.overlay) return;
    this.overlay.style.opacity = '1';
    this.overlay.style.visibility = 'visible';
  }

  private hideOverlay(): void {
    if (!this.overlay) return;
    this.overlay.style.opacity = '0';
    this.overlay.style.visibility = 'hidden';
  }

  private setupKeyboardHandlers(): void {
    this.keyboardHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.hasExpandedEditor()) {
        e.preventDefault();
        this.collapseAllEditors();
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === 'E') {
        e.preventDefault();
        this.handleGlobalToggle();
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  private handleGlobalToggle(): void {
    if (this.hasExpandedEditor()) {
      this.collapseAllEditors();
    } else {
      const firstEditor = document.querySelector<HTMLElement>('[data-editor-id]');
      if (firstEditor) {
        const editorId = firstEditor.dataset.editorId;
        if (editorId) {
          this.expandEditor(editorId);
        }
      }
    }
  }

  private loadSavedState(editorConfig: EditorConfig): void {
    const isExpanded = localStorage.getItem(editorConfig.storageKey) === 'true';
    if (isExpanded) {
      setTimeout(() => this.expandEditor(editorConfig.id), 100);
    }
  }

  private saveState(editorId: string, isExpanded: boolean): void {
    const storageKey = `${editorId}Expanded`;
    localStorage.setItem(storageKey, String(isExpanded));
  }

  destroy(): void {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
    }
    
    this.overlay?.remove();
    this.expandedEditors.clear();
    this.editorStrategies.clear();
  }
}

/**
 * Classe base para estratégias de editores (substituída por interface, mas mantida por compatibilidade com o JS original)
 */
export abstract class EditorStrategy implements IEditorStrategy {
  abstract setup(config: EditorConfig, manager: EditorExpansionManager): void;
  abstract expand(editorId: string): void;
  abstract collapse(editorId: string): void;
}
