/**
 * Utilitários para gerenciar estados de loading
 */

export interface LoadingOptions {
  text?: string;
  showSpinner?: boolean;
  overlay?: boolean;
  target?: HTMLElement;
}

export class LoadingManager {
  private activeLoadings: Map<string, HTMLElement> = new Map();

  /**
   * Mostrar loading
   */
  public show(id: string, options: LoadingOptions = {}): void {
    // Remover loading existente se houver
    this.hide(id);

    const {
      text = 'Carregando...',
      showSpinner = true,
      overlay = false,
      target = document.body
    } = options;

    const loadingElement = this.createLoadingElement(text, showSpinner, overlay);
    
    if (overlay) {
      document.body.appendChild(loadingElement);
    } else if (target) {
      target.style.position = 'relative';
      target.appendChild(loadingElement);
    }

    this.activeLoadings.set(id, loadingElement);
  }

  /**
   * Esconder loading
   */
  public hide(id: string): void {
    const loadingElement = this.activeLoadings.get(id);
    if (loadingElement && loadingElement.parentNode) {
      loadingElement.parentNode.removeChild(loadingElement);
      this.activeLoadings.delete(id);
    }
  }

  /**
   * Esconder todos os loadings
   */
  public hideAll(): void {
    for (const [id] of this.activeLoadings) {
      this.hide(id);
    }
  }

  /**
   * Criar elemento de loading
   */
  private createLoadingElement(text: string, showSpinner: boolean, overlay: boolean): HTMLElement {
    const element = document.createElement('div');
    element.className = overlay ? 'loading-overlay' : 'loading-inline';
    
    element.innerHTML = `
      <div class="loading-content">
        ${showSpinner ? '<div class="loading-spinner"></div>' : ''}
        <div class="loading-text">${text}</div>
      </div>
    `;

    return element;
  }

  /**
   * Atualizar texto de loading
   */
  public updateText(id: string, newText: string): void {
    const loadingElement = this.activeLoadings.get(id);
    if (loadingElement) {
      const textElement = loadingElement.querySelector('.loading-text');
      if (textElement) {
        textElement.textContent = newText;
      }
    }
  }

  /**
   * Verificar se loading está ativo
   */
  public isActive(id: string): boolean {
    return this.activeLoadings.has(id);
  }
}

// Instância global
declare global {
  interface Window {
    loadingManager: LoadingManager;
  }
}

if (typeof window !== 'undefined') {
  window.loadingManager = new LoadingManager();
}

/**
 * Decorator para métodos async com loading automático
 */
export function withLoading(loadingId: string, options?: LoadingOptions) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const loadingManager = window.loadingManager;
      
      if (loadingManager) {
        loadingManager.show(loadingId, options);
      }

      try {
        const result = await method.apply(this, args);
        return result;
      } finally {
        if (loadingManager) {
          loadingManager.hide(loadingId);
        }
      }
    };

    return descriptor;
  };
}
