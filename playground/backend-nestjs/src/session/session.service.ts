import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as vm from 'vm';
import { newPage, Page } from '@felinto-dev/felinto-connect-bot';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { SessionConfig, SessionData, PageInfo, ExecutionResult, SessionStats } from '../common/types/session.types';

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Sessão não encontrada: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private sessions: Map<string, SessionData> = new Map();
  private sessionTimeout: number = 10 * 60 * 1000; // 10 minutos
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(private readonly websocketGateway: WebsocketGateway) {}

  onModuleInit() {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60 * 1000); // A cada 60 segundos
  }

  async onModuleDestroy() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    await this.cleanup();
  }

  async createSession(config: SessionConfig): Promise<SessionData> {
    const sessionId = uuidv4();

    try {
      this.websocketGateway.broadcast({ type: 'info', message: '🆔 Criando sessão' });

      const page = await newPage(config);
      const pageInfo = await this.getPageInfo(page);

      const sessionData: SessionData = {
        id: sessionId,
        page,
        config,
        createdAt: new Date(),
        lastUsed: new Date(),
        pageInfo,
        executionCount: 0,
      };

      this.sessions.set(sessionId, sessionData);

      this.websocketGateway.broadcast({ type: 'success', message: '✅ Sessão criada' });

      return sessionData;
    } catch (error) {
      this.websocketGateway.broadcast({ type: 'error', message: `❌ Erro ao criar sessão: ${error.message}` });
      throw error;
    }
  }

  getSession(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastUsed = new Date();
      return session;
    }
    return undefined;
  }

  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      await session.page.evaluate(() => document.title);
      return true;
    } catch (error) {
      await this.removeSession(sessionId);
      return false;
    }
  }

  async executeCode(sessionId: string, code: string): Promise<ExecutionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    session.executionCount++;

    try {
      this.websocketGateway.broadcast({ type: 'info', message: `💻 Executando código (#${session.executionCount})` });

      const context = this.createSecureContext(session.page);
      const result = await this.executeWithTimeout(code, context, 30000);
      const pageInfo = await this.getPageInfo(session.page);

      this.websocketGateway.broadcast({ type: 'success', message: '✅ Código executado', data: { result, pageInfo } });

      return {
        result,
        pageInfo,
        executionCount: session.executionCount,
      };
    } catch (error) {
      this.websocketGateway.broadcast({ type: 'error', message: `❌ Erro na execução: ${error.message}` });
      throw error;
    }
  }

  private createSecureContext(page: Page): object {
    return {
      page,
      console: {
        log: (...args: any[]) => {
          this.websocketGateway.broadcast({ type: 'log', message: '📝', data: { args } });
          console.log(`[Session Console] LOG:`, ...args);
        },
        error: (...args: any[]) => {
          this.websocketGateway.broadcast({ type: 'error', message: '🔴', data: { args } });
          console.error(`[Session Console] ERROR:`, ...args);
        },
        warn: (...args: any[]) => {
          this.websocketGateway.broadcast({ type: 'warning', message: '⚠️', data: { args } });
          console.warn(`[Session Console] WARN:`, ...args);
        },
        info: (...args: any[]) => {
          this.websocketGateway.broadcast({ type: 'info', message: 'ℹ️', data: { args } });
          console.info(`[Session Console] INFO:`, ...args);
        },
      },
      setTimeout: (callback: Function, delay: number) => {
        if (delay > 5000) {
          throw new Error('Timeout máximo permitido é de 5 segundos');
        }
        return setTimeout(callback, delay);
      },
      require: undefined,
      process: undefined,
      global: undefined,
      Buffer: undefined,
      __dirname: undefined,
      __filename: undefined,
    };
  }

  private async executeWithTimeout(
    code: string,
    context: object,
    timeout: number,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout: Execução cancelada após 30 segundos'));
      }, timeout);

      try {
        // Envolver o código em uma função async para permitir await no nível superior
        const wrappedCode = `
          (async function() {
            ${code}
          })()
        `;

        // Criar contexto VM
        const vmContext = vm.createContext(context);

        // Executar código envolvido
        const result = vm.runInContext(wrappedCode, vmContext, {
          timeout: timeout,
          displayErrors: true,
        });

        clearTimeout(timer);

        // O resultado sempre será uma Promise devido ao wrapper async
        if (result && typeof result.then === 'function') {
          result
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timer));
        } else {
          resolve(result);
        }
      } catch (error: any) {
        clearTimeout(timer);

        // Melhorar mensagens de erro
        let errorMessage = error.message;

        if (error.message.includes('Unexpected token')) {
          errorMessage = `Erro de sintaxe: ${error.message}. Verifique se o código JavaScript está correto.`;
        } else if (error.message.includes('is not defined')) {
          errorMessage = `Variável não definida: ${error.message}. Lembre-se que apenas 'page' e 'console' estão disponíveis.`;
        }

        reject(new Error(errorMessage));
      }
    });
  }

  async getPageInfo(page: Page): Promise<PageInfo> {
    try {
      const [url, title] = await Promise.all([
        page.url(),
        page.title(),
      ]);

      return {
        url,
        title,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        url: 'Erro ao capturar URL',
        title: 'Erro ao capturar título',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  async takeScreenshot(sessionId: string, options?: any): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    try {
      const screenshotOptions: any = {
        type: options?.quality ? 'jpeg' : 'png',
        encoding: 'base64',
        fullPage: false,
        ...options,
      };

      if (screenshotOptions.type === 'png') {
        delete screenshotOptions.quality;
      }

      const screenshot = await session.page.screenshot(screenshotOptions);
      return screenshot as string;
    } catch (error) {
      throw new Error(`Erro ao capturar screenshot: ${error.message}`);
    }
  }

  async removeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      this.websocketGateway.broadcast({ type: 'info', message: '🔒 Fechando página' });

      if (!session.page.isClosed()) {
        await session.page.close();
      }

      this.sessions.delete(sessionId);

      this.websocketGateway.broadcast({ type: 'info', message: '🗑️ Sessão removida' });

      return true;
    } catch (error) {
      this.websocketGateway.broadcast({ type: 'error', message: `❌ Erro ao remover sessão: ${error.message}` });
      throw error;
    }
  }

  private async cleanupInactiveSessions() {
    const now = new Date();
    const sessionsToRemove: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastUse = now.getTime() - session.lastUsed.getTime();

      if (timeSinceLastUse > this.sessionTimeout) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      await this.removeSession(sessionId);
      console.log(`🧹 Sessão inativa removida: ${sessionId}`);

      // Notificar via WebSocket com formato igual ao legacy
      this.websocketGateway.broadcast({
        type: 'session_expired',
        message: `🕐 Sessão ${sessionId.substring(0, 8)}... expirou por inatividade (${Math.round(this.sessionTimeout / 60000)} min)`,
        sessionId
      });
    }
  }

  getStats(): SessionStats {
    const sessions = Array.from(this.sessions.values());
    const now = new Date();

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(session =>
        now.getTime() - session.lastUsed.getTime() < 60000
      ).length,
      totalExecutions: sessions.reduce((sum, session) => sum + session.executionCount, 0),
      oldestSession: sessions.length > 0
        ? Math.min(...sessions.map(s => s.createdAt.getTime()))
        : null,
    };
  }

  public notifySessionExpired(sessionId?: string) {
    const message = sessionId
      ? `🕐 Sessão ${sessionId.substring(0, 8)}... expirou por inatividade (${Math.round(this.sessionTimeout / 60000)} min)`
      : '⏰ A sessão expirou ou foi removida';

    this.websocketGateway.broadcast({
      type: 'session_expired',
      message,
      ...(sessionId && { sessionId })
    });
  }

  public notifyScreenshotCapture(status: 'starting' | 'success') {
    if (status === 'starting') {
      this.websocketGateway.broadcast({ type: 'info', message: '📸 Capturando screenshot' });
    } else {
      this.websocketGateway.broadcast({ type: 'success', message: '✅ Screenshot capturado' });
    }
  }

  private async cleanup() {
    const sessionIds = Array.from(this.sessions.keys());

    await Promise.allSettled(
      sessionIds.map(async (sessionId) => {
        try {
          await this.removeSession(sessionId);
        } catch (error) {
          console.error(`Erro ao limpar sessão ${sessionId}:`, error);
        }
      })
    );

    this.sessions.clear();
    console.log('🧹 Cleanup concluído');
  }
}