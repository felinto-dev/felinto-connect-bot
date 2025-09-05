import './style.css';
import { SharedServices } from './shared';
import { RecordingManager } from './recording/RecordingManager';

// Adicionar a propriedade 'recordingApp' à interface Window
declare global {
  interface Window {
    recordingApp: RecordingApp;
  }
}

class RecordingApp {
  public sharedServices: SharedServices;
  public recordingManager: RecordingManager;

  constructor() {
    this.sharedServices = new SharedServices();
    this.recordingManager = new RecordingManager(this.sharedServices);
    this.init();
  }

  private init(): void {
    this.setupWebSocket();
    this.recordingManager.init();
    this.initializeIcons();
    this.setupDocumentationModal();
  }

  private setupWebSocket(): void {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:3001/ws`;
    this.connectWebSocket(wsUrl);
  }

  private connectWebSocket(url: string): void {
    try {
      const ws = new WebSocket(url);
      
      ws.onopen = () => console.log('🔗 Conectado ao servidor WebSocket');
      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Mensagem recebida:', data);
        } catch (error) {
          console.log('📨 Mensagem:', event.data);
        }
      };
      ws.onclose = () => {
        console.log('🔌 Conexão perdida. Tentando reconectar...');
        setTimeout(() => this.connectWebSocket(url), 3000);
      };
      ws.onerror = () => console.error('❌ Erro na conexão WebSocket');

    } catch (error) {
      console.error('❌ Erro ao conectar WebSocket:', error);
    }
  }

  private initializeIcons(): void {
    const initLucide = () => {
      if (typeof window.lucide !== 'undefined') {
        try {
          window.lucide.createIcons();
        } catch (error) {
          console.error('Erro ao inicializar ícones Lucide:', error);
        }
      } else {
        setTimeout(initLucide, 100);
      }
    };
    initLucide();
  }

  private setupDocumentationModal(): void {
    const docsBtn = document.getElementById('docsBtn');
    const closeDocsModal = document.getElementById('closeDocsModal');
    const docsModal = document.getElementById('docsModal');

    docsBtn?.addEventListener('click', () => {
      if (docsModal) {
        docsModal.style.display = 'block';
      }
    });

    closeDocsModal?.addEventListener('click', () => {
      if (docsModal) {
        docsModal.style.display = 'none';
      }
    });

    // Fechar modal clicando no overlay
    document.addEventListener('click', (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
        if (docsModal) {
          docsModal.style.display = 'none';
        }
      }
    });

    // Fechar modal com ESC
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && docsModal && docsModal.style.display !== 'none') {
        docsModal.style.display = 'none';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    window.recordingApp = new RecordingApp();
  }, 100);
});
