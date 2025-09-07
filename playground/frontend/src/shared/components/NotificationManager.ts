export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
}

export class NotificationManager {
  private notifications: Map<string, Notification> = new Map();
  private container: HTMLElement | null = null;

  constructor() {
    this.createContainer();
  }

  /**
   * Criar container de notificações
   */
  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'notificationContainer';
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  /**
   * Mostrar notificação
   */
  public show(type: NotificationType, title: string, message: string, options?: {
    duration?: number;
    persistent?: boolean;
  }): string {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: Notification = {
      id,
      type,
      title,
      message,
      duration: options?.duration || (type === 'error' ? 8000 : 5000),
      persistent: options?.persistent || false
    };

    this.notifications.set(id, notification);
    this.renderNotification(notification);

    // Auto-remove se não for persistente
    if (!notification.persistent && notification.duration) {
      setTimeout(() => {
        this.remove(id);
      }, notification.duration);
    }

    return id;
  }

  /**
   * Renderizar notificação
   */
  private renderNotification(notification: Notification): void {
    if (!this.container) return;

    const element = document.createElement('div');
    element.className = `notification notification-${notification.type}`;
    element.setAttribute('data-notification-id', notification.id);

    const icon = this.getIcon(notification.type);
    
    element.innerHTML = `
      <div class="notification-content">
        <div class="notification-header">
          <i data-lucide="${icon}" class="notification-icon"></i>
          <span class="notification-title">${notification.title}</span>
          <button class="notification-close" onclick="window.notificationManager?.remove('${notification.id}')">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="notification-message">${notification.message}</div>
        ${!notification.persistent && notification.duration ? `
          <div class="notification-progress">
            <div class="progress-bar" style="animation-duration: ${notification.duration}ms;"></div>
          </div>
        ` : ''}
      </div>
    `;

    // Adicionar animação de entrada
    element.style.opacity = '0';
    element.style.transform = 'translateX(100%)';
    this.container.appendChild(element);

    // Trigger animação
    requestAnimationFrame(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateX(0)';
    });

    // Reinicializar ícones Lucide
    if (typeof window.lucide !== 'undefined') {
      window.lucide.createIcons();
    }
  }

  /**
   * Remover notificação
   */
  public remove(id: string): void {
    const notification = this.notifications.get(id);
    if (!notification || !this.container) return;

    const element = this.container.querySelector(`[data-notification-id="${id}"]`) as HTMLElement;
    if (element) {
      // Animação de saída
      element.style.opacity = '0';
      element.style.transform = 'translateX(100%)';
      
      setTimeout(() => {
        if (this.container && element.parentNode === this.container) {
          this.container.removeChild(element);
        }
        this.notifications.delete(id);
      }, 300);
    }
  }

  /**
   * Limpar todas as notificações
   */
  public clear(): void {
    this.notifications.clear();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Obter ícone para tipo de notificação
   */
  private getIcon(type: NotificationType): string {
    const icons = {
      success: 'check-circle',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };
    return icons[type] || 'info';
  }

  /**
   * Métodos de conveniência
   */
  public success(title: string, message: string, duration?: number): string {
    return this.show('success', title, message, { duration });
  }

  public error(title: string, message: string, persistent?: boolean): string {
    return this.show('error', title, message, { persistent });
  }

  public warning(title: string, message: string, duration?: number): string {
    return this.show('warning', title, message, { duration });
  }

  public info(title: string, message: string, duration?: number): string {
    return this.show('info', title, message, { duration });
  }
}

// Instância global
declare global {
  interface Window {
    notificationManager: NotificationManager;
  }
}

// Criar instância global
if (typeof window !== 'undefined') {
  window.notificationManager = new NotificationManager();
}
