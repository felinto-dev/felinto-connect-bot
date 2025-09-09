import './style.css';
import { SharedServices } from './shared';
import { RecordingManager } from './recording/RecordingManager';
import { NotificationManager } from './shared/components/NotificationManager';
import type { RecordingWebSocketMessage } from './shared/types/recording';

// Adicionar a propriedade 'recordingApp' à interface Window
declare global {
  interface Window {
    recordingApp: RecordingApp;
  }
}

class RecordingApp {
  public sharedServices: SharedServices;
  public recordingManager: RecordingManager;
  private websocket: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: number = 3000;

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
      this.websocket = new WebSocket(url);
      
      this.websocket.onopen = () => {
        console.log('🔗 Conectado ao servidor WebSocket');
        this.reconnectAttempts = 0;
        this.recordingManager.setWebSocketConnected(true);
      };

      this.websocket.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.log('📨 Mensagem não-JSON:', event.data);
        }
      };

      this.websocket.onclose = () => {
        console.log('🔌 Conexão WebSocket perdida');
        this.recordingManager.setWebSocketConnected(false);
        this.attemptReconnect(url);
      };

      this.websocket.onerror = (error) => {
        console.error('❌ Erro na conexão WebSocket:', error);
        this.recordingManager.setWebSocketConnected(false);
      };

    } catch (error) {
      console.error('❌ Erro ao conectar WebSocket:', error);
      this.recordingManager.setWebSocketConnected(false);
    }
  }

  /**
   * Tentar reconectar WebSocket
   */
  private attemptReconnect(url: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ Máximo de tentativas de reconexão atingido (${this.maxReconnectAttempts})`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1); // Backoff exponencial
    
    console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${delay}ms...`);
    
    setTimeout(() => {
      this.connectWebSocket(url);
    }, delay);
  }

  /**
   * Processar mensagens WebSocket
   */
  private handleWebSocketMessage(data: any): void {
    console.log('📨 Mensagem WebSocket recebida:', data);

    // Verificar se é mensagem relacionada à gravação
    if (this.isRecordingMessage(data)) {
      this.handleRecordingMessage(data);
      return;
    }

    // Processar outras mensagens (logs, status, etc.)
    this.handleGeneralMessage(data);
  }

  /**
   * Verificar se a mensagem é relacionada à gravação
   */
  private isRecordingMessage(data: any): boolean {
    const isRecording = data.type && (
      data.type === 'recording_event' ||
      data.type === 'recording_status' ||
      data.recordingId
    );
    
    // Removido log de debug para limpeza da saída
    
    return isRecording;
  }

  /**
   * Processar mensagens de gravação
   */
  private handleRecordingMessage(data: any): void {
    const message: RecordingWebSocketMessage = {
      type: data.type,
      recordingId: data.recordingId,
      sessionId: data.sessionId,
      data: data.data,
      timestamp: data.timestamp || Date.now()
    };

    // Delegar para o RecordingManager
    this.recordingManager.handleWebSocketMessage(message);
  }

  /**
   * Processar mensagens gerais
   */
  private handleGeneralMessage(data: any): void {
    switch (data.type) {
      case 'info':
        console.log(`ℹ️ ${data.message}`);
        break;
      case 'success':
        console.log(`✅ ${data.message}`);
        break;
      case 'warning':
        console.warn(`⚠️ ${data.message}`);
        break;
      case 'error':
        console.error(`❌ ${data.message}`);
        break;
      case 'session_expired':
        console.warn(`🔒 Sessão expirada: ${data.message}`);
        this.recordingManager.handleSessionExpired();
        break;
      default:
        console.log('📨 Mensagem:', data);
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
