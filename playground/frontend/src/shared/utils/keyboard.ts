/**
 * Sistema de atalhos de teclado
 */

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
  enabled?: () => boolean;
}

export class KeyboardManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isEnabled: boolean = true;

  constructor() {
    this.setupGlobalListener();
  }

  /**
   * Registrar atalho de teclado
   */
  public register(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
    console.log(`⌨️ Atalho registrado: ${this.getShortcutDisplay(shortcut)}`);
  }

  /**
   * Remover atalho de teclado
   */
  public unregister(key: string, ctrlKey?: boolean, shiftKey?: boolean, altKey?: boolean): void {
    const shortcutKey = this.getShortcutKey({ key, ctrlKey, shiftKey, altKey } as KeyboardShortcut);
    this.shortcuts.delete(shortcutKey);
  }

  /**
   * Habilitar/desabilitar sistema de atalhos
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Configurar listener global
   */
  private setupGlobalListener(): void {
    document.addEventListener('keydown', (e) => {
      if (!this.isEnabled) return;

      // Ignorar se estiver em input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.contentEditable === 'true') {
        return;
      }

      // Ignorar se modal estiver aberto
      const hasModal = document.querySelector('.modal[style*="display: block"]');
      if (hasModal) return;

      const shortcutKey = this.getShortcutKey({
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      } as KeyboardShortcut);

      const shortcut = this.shortcuts.get(shortcutKey);
      if (shortcut) {
        // Verificar se está habilitado
        if (shortcut.enabled && !shortcut.enabled()) {
          return;
        }

        e.preventDefault();
        shortcut.action();
        
        console.log(`⌨️ Atalho executado: ${this.getShortcutDisplay(shortcut)}`);
      }
    });
  }

  /**
   * Gerar chave única para atalho
   */
  private getShortcutKey(shortcut: { key: string; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }): string {
    const parts = [];
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    parts.push(shortcut.key);
    return parts.join('+');
  }

  /**
   * Gerar display do atalho para UI
   */
  private getShortcutDisplay(shortcut: KeyboardShortcut): string {
    const parts = [];
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    parts.push(shortcut.key);
    return parts.join(' + ');
  }

  /**
   * Obter todos os atalhos registrados
   */
  public getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Mostrar ajuda de atalhos
   */
  public showHelp(): void {
    const shortcuts = this.getShortcuts();
    if (shortcuts.length === 0) return;

    let helpText = 'Atalhos de Teclado Disponíveis:\n\n';
    shortcuts.forEach(shortcut => {
      helpText += `${this.getShortcutDisplay(shortcut)} - ${shortcut.description}\n`;
    });

    if (window.notificationManager) {
      window.notificationManager.info('Atalhos de Teclado', helpText.replace(/\n/g, '<br>'));
    } else {
      alert(helpText);
    }
  }
}

// Instância global
declare global {
  interface Window {
    keyboardManager: KeyboardManager;
  }
}

if (typeof window !== 'undefined') {
  window.keyboardManager = new KeyboardManager();
}
