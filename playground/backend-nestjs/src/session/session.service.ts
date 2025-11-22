import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as vm from 'vm';
import { newPage, Page } from '@felinto-dev/felinto-connect-bot';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { SessionConfig, SessionData, PageInfo, ExecutionResult, SessionStats } from '../common/types/session.types';

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private sessions: Map<string, SessionData> = new Map();
  private sessionTimeout: number = 10 * 60 * 1000; // 10 minutos
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private executionCount: number = 0;

  constructor(private readonly websocketGateway: WebsocketGateway) {}

  onModuleInit() {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60 * 1000); // A cada 60 segundos
  }

  onModuleDestroy() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    this.cleanup();
  }

  async createSession(config: SessionConfig): Promise<SessionData> {
    const sessionId = uuidv4();

    try {
      this.websocketGateway.broadcast('info', '🆔 Criando sessão');

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

      this.websocketGateway.broadcast('success', '✅ Sessão criada');

      return sessionData;
    } catch (error) {
      this.websocketGateway.broadcast('error', `❌ Erro ao criar sessão: ${error.message}`);
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
      throw new Error('Sessão não encontrada');
    }

    session.executionCount++;
    this.executionCount++;

    try {
      this.websocketGateway.broadcast('info', `💻 Executando código (#${session.executionCount})`);

      const context = this.createSecureContext(session.page);
      const result = await this.executeWithTimeout(code, context, 30000);
      const pageInfo = await this.getPageInfo(session.page);

      this.websocketGateway.broadcast('success', '✅ Código executado', { result, pageInfo });

      return {
        result,
        pageInfo,
        executionCount: session.executionCount,
      };
    } catch (error) {
      this.websocketGateway.broadcast('error', `❌ Erro na execução: ${error.message}`);
      throw error;
    }
  }

  private createSecureContext(page: Page): object {
    return {
      page,
      console: {
        log: (...args: any[]) => {
          this.websocketGateway.broadcast('log', '📝', { args });
          console.log(`[Session Console] LOG:`, ...args);
        },
        error: (...args: any[]) => {
          this.websocketGateway.broadcast('error', '🔴', { args });
          console.error(`[Session Console] ERROR:`, ...args);
        },
        warn: (...args: any[]) => {
          this.websocketGateway.broadcast('warning', '⚠️', { args });
          console.warn(`[Session Console] WARN:`, ...args);
        },
        info: (...args: any[]) => {
          this.websocketGateway.broadcast('info', 'ℹ️', { args });
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

  private executeWithTimeout(code: string, context: object, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout de execução'));
      }, timeout);

      try {
        const wrappedCode = `(async function() { ${code} })()`;
        const vmContext = vm.createContext(context);

        vm.runInContext(wrappedCode, vmContext, { timeout, displayErrors: true });

        // Para async functions, precisamos esperar o resultado
        vm.runInContext(`
          (async function() {
            try {
              const result = await ${wrappedCode};
              process._resolve(result);
            } catch (error) {
              process._reject(error);
            }
          })()
        `, vm.createContext({
          ...context,
          process: {
            _resolve: (result: any) => {
              clearTimeout(timer);
              resolve(result);
            },
            _reject: (error: any) => {
              clearTimeout(timer);
              reject(error);
            },
          },
        }), { timeout, displayErrors: true });

      } catch (error) {
        clearTimeout(timer);

        if (error.message.includes('Unexpected token')) {
          reject(new Error('Erro de sintaxe no código'));
        } else if (error.message.includes('is not defined')) {
          reject(new Error(`Variável não definida: ${error.message.split(' ')[0]}`));
        } else {
          reject(error);
        }
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
        url: 'N/A',
        title: 'N/A',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  async takeScreenshot(sessionId: string, options?: any): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Sessão não encontrada');
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
      this.websocketGateway.broadcast('info', '🔒 Fechando página');

      if (!session.page.isClosed()) {
        await session.page.close();
      }

      this.sessions.delete(sessionId);

      this.websocketGateway.broadcast('info', '🗑️ Sessão removida');

      return true;
    } catch (error) {
      this.websocketGateway.broadcast('error', `❌ Erro ao remover sessão: ${error.message}`);
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
      this.websocketGateway.broadcast('session_expired', `⏰ Sessão expirou por inatividade (${this.sessionTimeout / 60000} minutos)`);
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