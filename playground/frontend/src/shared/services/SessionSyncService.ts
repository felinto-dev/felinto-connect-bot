import type { SharedServices } from '../index';

export interface SessionInfo {
  sessionId: string;
  createdAt: number;
  lastUsed: number;
  pageInfo?: {
    url: string;
    title: string;
  };
}

export class SessionSyncService {
  private sharedServices: SharedServices;
  private storageKey = 'felinto-playground-session';
  private checkInterval: number | null = null;
  private onSessionChangeCallback?: (sessionInfo: SessionInfo | null) => void;

  constructor(sharedServices: SharedServices) {
    this.sharedServices = sharedServices;
    this.setupStorageListener();
  }

  /**
   * Configurar listener para mudanças no localStorage
   */
  private setupStorageListener(): void {
    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey) {
        const sessionInfo = this.getStoredSession();
        console.log('📡 Mudança de sessão detectada via storage:', sessionInfo);
        this.notifySessionChange(sessionInfo);
      }
    });
  }

  /**
   * Armazenar informações da sessão
   */
  public storeSession(sessionInfo: SessionInfo): void {
    const data = {
      ...sessionInfo,
      lastUsed: Date.now()
    };
    
    localStorage.setItem(this.storageKey, JSON.stringify(data));
    console.log('💾 Sessão armazenada:', data);
    
    // NÃO notificar mudança aqui para evitar loops
    // Apenas o storage event vai notificar outras páginas
  }

  /**
   * Obter sessão armazenada
   */
  public getStoredSession(): SessionInfo | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return null;
      
      const sessionInfo = JSON.parse(stored) as SessionInfo;
      
      // Verificar se a sessão não está muito antiga (24 horas)
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas
      if (Date.now() - sessionInfo.createdAt > maxAge) {
        this.clearStoredSession();
        return null;
      }
      
      return sessionInfo;
    } catch (error) {
      console.error('❌ Erro ao ler sessão do localStorage:', error);
      this.clearStoredSession();
      return null;
    }
  }

  /**
   * Limpar sessão armazenada
   */
  public clearStoredSession(): void {
    localStorage.removeItem(this.storageKey);
    console.log('🗑️ Sessão removida do localStorage');
    // NÃO notificar aqui para evitar loops - storage event vai notificar
  }

  /**
   * Verificar se sessão ainda está ativa no backend
   */
  public async validateStoredSession(): Promise<SessionInfo | null> {
    const storedSession = this.getStoredSession();
    if (!storedSession) return null;

    try {
      console.log('🔍 Validando sessão armazenada:', storedSession.sessionId);
      
      // Tentar fazer uma chamada simples para verificar se a sessão ainda existe
      // Usando o endpoint de status de gravação como health check
      const response = await this.sharedServices.apiService.getRecordingStatus(storedSession.sessionId);
      
      // Se chegou até aqui, a sessão ainda é válida
      console.log('✅ Sessão ainda é válida');
      
      // Atualizar lastUsed
      this.storeSession({
        ...storedSession,
        lastUsed: Date.now()
      });
      
      return storedSession;
      
    } catch (error: any) {
      console.warn('⚠️ Sessão armazenada não é mais válida:', error.message);
      
      // Se erro indica sessão expirada, remover do storage silenciosamente
      if (error.message?.includes('Sessão não encontrada') || 
          error.message?.includes('sessionExpired') ||
          error.message?.includes('Sessão foi fechada')) {
        
        // Limpar sem logs para evitar spam
        localStorage.removeItem(this.storageKey);
      }
      
      return null;
    }
  }

  /**
   * Iniciar verificação periódica de sessões ativas
   */
  public startSessionCheck(): void {
    // DESABILITADO temporariamente para evitar loops
    // A verificação será feita apenas sob demanda
    console.log('ℹ️ Verificação periódica desabilitada para evitar loops');
  }

  /**
   * Parar verificação periódica
   */
  public stopSessionCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏸️ Verificação periódica de sessão parada');
    }
  }

  /**
   * Configurar callback para mudanças de sessão
   */
  public onSessionChange(callback: (sessionInfo: SessionInfo | null) => void): void {
    this.onSessionChangeCallback = callback;
  }

  /**
   * Notificar mudança de sessão
   */
  private notifySessionChange(sessionInfo: SessionInfo | null): void {
    if (this.onSessionChangeCallback) {
      this.onSessionChangeCallback(sessionInfo);
    }
  }

  /**
   * Obter sessão ativa (com validação)
   */
  public async getActiveSession(): Promise<SessionInfo | null> {
    // Primeiro verificar se há sessão armazenada
    const storedSession = this.getStoredSession();
    if (!storedSession) return null;

    // Validar se ainda está ativa
    return await this.validateStoredSession();
  }

  /**
   * Marcar sessão como usada recentemente
   */
  public touchSession(): void {
    const session = this.getStoredSession();
    if (session) {
      this.storeSession({
        ...session,
        lastUsed: Date.now()
      });
    }
  }

  /**
   * Notificar outras páginas sobre nova sessão
   */
  public notifySessionCreated(sessionId: string, pageInfo?: any): void {
    this.storeSession({
      sessionId,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      pageInfo
    });
    
    console.log('📡 Notificação de nova sessão enviada:', sessionId);
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.stopSessionCheck();
    this.onSessionChangeCallback = undefined;
    console.log('🧹 SessionSyncService destruído');
  }
}
