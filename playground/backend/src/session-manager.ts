import { v4 as uuidv4 } from 'uuid';
import vm from 'vm';
import { newPage } from '@felinto-dev/felinto-connect-bot';
import type { Page } from 'puppeteer';
import {
  BroadcastFn,
  SessionConfig,
  SessionData,
  ExecutionResult,
  PageInfo,
  SessionStats,
} from './types.js';

class SessionManager {
  private sessions: Map<string, SessionData>;
  private sessionTimeout: number;
  private broadcastFn: BroadcastFn | null;

  constructor(broadcastFn: BroadcastFn | null = null) {
    this.sessions = new Map<string, SessionData>();
    this.sessionTimeout = 10 * 60 * 1000; // 10 minutos
    this.broadcastFn = broadcastFn;

    // Limpeza automática de sessões inativas
    setInterval(() => {
      this.cleanupInactiveSessions(this.broadcastFn);
    }, 60 * 1000); // Verificar a cada minuto
  }

  /**
   * Criar nova sessão com página Puppeteer
   */
  async createSession(config: SessionConfig, broadcastFn: BroadcastFn): Promise<SessionData> {
    const sessionId = uuidv4();

    try {
      broadcastFn({ type: 'info', message: `🆔 Criando sessão: ${sessionId}` });

      // Criar página usando a configuração fornecida
      const page = await newPage(config);

      const session: SessionData = {
        id: sessionId,
        page,
        config,
        createdAt: new Date(),
        lastUsed: new Date(),
        executionCount: 0,
      };

      this.sessions.set(sessionId, session);

      broadcastFn({ type: 'success', message: `✅ Sessão criada: ${sessionId}` });

      return session;
    } catch (error: any) {
      broadcastFn({
        type: 'error',
        message: `❌ Erro ao criar sessão: ${error.message}`,
      });
      throw error;
    }
  }

  /**
   * Obter sessão existente
   */
  getSession(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastUsed = new Date();
    }
    return session;
  }

  /**
   * Executar código JavaScript no contexto da página
   */
  async executeCode(
    sessionId: string,
    code: string,
    broadcastFn: BroadcastFn,
  ): Promise<ExecutionResult> {
    const session = this.getSession(sessionId);

    if (!session) {
      throw new Error(`Sessão não encontrada: ${sessionId}`);
    }

    try {
      session.executionCount++;
      broadcastFn({
        type: 'info',
        message: `🚀 Executando código (execução #${session.executionCount})...`,
      });

      // Criar contexto seguro para execução
      const context = this.createSecureContext(session.page, broadcastFn);

      // Executar código com timeout
      const result = await this.executeWithTimeout(code, context, 30000);

      // Capturar informações da página após execução
      const pageInfo = await this.getPageInfo(session.page);

      broadcastFn({
        type: 'success',
        message: `✅ Código executado com sucesso!`,
        data: {
          result,
          pageInfo,
          executionCount: session.executionCount,
        },
      });

      return { result, pageInfo };
    } catch (error: any) {
      broadcastFn({
        type: 'error',
        message: `❌ Erro na execução: ${error.message}`,
      });
      throw error;
    }
  }

  /**
   * Criar contexto seguro para execução de código
   */
  private createSecureContext(page: Page, broadcastFn: BroadcastFn) {
    // Console customizado que envia logs via WebSocket
    const customConsole = {
      log: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
          )
          .join(' ');
        broadcastFn({ type: 'log', message: `📝 ${message}` });
      },
      error: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
          )
          .join(' ');
        broadcastFn({ type: 'error', message: `🔴 ${message}` });
      },
      warn: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
          )
          .join(' ');
        broadcastFn({ type: 'warning', message: `⚠️ ${message}` });
      },
      info: (...args: any[]) => {
        const message = args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
          )
          .join(' ');
        broadcastFn({ type: 'info', message: `ℹ️ ${message}` });
      },
    };

    // Contexto com apenas APIs seguras
    return {
      page,
      console: customConsole,
      // Utilitários seguros
      setTimeout: (fn: () => void, delay: number) =>
        setTimeout(fn, Math.min(delay, 5000)), // Max 5s
      // Bloquear APIs perigosas
      require: undefined,
      process: undefined,
      global: undefined,
      Buffer: undefined,
      __dirname: undefined,
      __filename: undefined,
    };
  }

  /**
   * Executar código com timeout
   */
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

  /**
   * Capturar informações da página
   */
  async getPageInfo(page: Page): Promise<PageInfo> {
    try {
      const [url, title] = await Promise.all([page.url(), page.title()]);

      return {
        url,
        title,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        url: 'Erro ao capturar URL',
        title: 'Erro ao capturar título',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Capturar screenshot da página
   */
  async takeScreenshot(
    sessionId: string,
    options: object = {},
  ): Promise<string> {
    const session = this.getSession(sessionId);

    if (!session) {
      throw new Error(`Sessão não encontrada: ${sessionId}`);
    }

    try {
      const screenshot = await session.page.screenshot({
        type: 'png',
        encoding: 'base64',
        fullPage: false,
        ...options,
      });

      return screenshot as string;
    } catch (error: any) {
      throw new Error(`Erro ao capturar screenshot: ${error.message}`);
    }
  }

  /**
   * Remover sessão
   */
  async removeSession(
    sessionId: string,
    broadcastFn?: BroadcastFn,
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (session) {
      try {
        // Fechar página - sempre executar page.close()
        if (session.page && !session.page.isClosed()) {
          if (broadcastFn) {
            broadcastFn({
              type: 'info',
              message: `🔒 Fechando página da sessão: ${sessionId}`,
            });
          }
          await session.page.close();
        }

        this.sessions.delete(sessionId);

        if (broadcastFn) {
          broadcastFn({
            type: 'info',
            message: `🗑️ Sessão removida: ${sessionId}`,
          });
        }

        return true;
      } catch (error: any) {
        if (broadcastFn) {
          broadcastFn({
            type: 'error',
            message: `❌ Erro ao remover sessão: ${error.message}`,
          });
        }
        throw error;
      }
    }

    return false;
  }

  /**
   * Limpeza automática de sessões inativas
   */
  private cleanupInactiveSessions(broadcastFn: BroadcastFn | null = null) {
    const now = new Date();
    const sessionsToRemove: { sessionId: string; session: SessionData }[] = [];

    for (const [sessionId, session] of this.sessions) {
      const timeSinceLastUse = now.getTime() - session.lastUsed.getTime();

      if (timeSinceLastUse > this.sessionTimeout) {
        sessionsToRemove.push({ sessionId, session });
      }
    }

    // Remover sessões inativas
    sessionsToRemove.forEach(({ sessionId }) => {
      this.removeSession(sessionId, this.broadcastFn ?? undefined);
      console.log(`🧹 Sessão inativa removida: ${sessionId}`);

      // Notificar via WebSocket se função de broadcast disponível
      if (broadcastFn) {
        broadcastFn({
          type: 'session_expired',
          message: `🕐 Sessão ${sessionId.substring(
            0,
            8,
          )}... expirou por inatividade (${Math.round(
            this.sessionTimeout / 60000,
          )} min)`,
          sessionId: sessionId,
        });
      }
    });
  }

  /**
   * Obter estatísticas das sessões
   */
  getStats(): SessionStats {
    const sessions = Array.from(this.sessions.values());

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(
        (s) => new Date().getTime() - s.lastUsed.getTime() < 60000,
      ).length, // Ativas nos últimos 60s
      totalExecutions: sessions.reduce((sum, s) => sum + s.executionCount, 0),
      oldestSession:
        sessions.length > 0
          ? Math.min(...sessions.map((s) => s.createdAt.getTime()))
          : null,
    };
  }

  /**
   * Limpar todas as sessões (para shutdown gracioso)
   */
  async cleanup(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    
    // Fechar todas as sessões em paralelo
    const cleanupPromises = sessionIds.map(async (sessionId) => {
      try {
        await this.removeSession(sessionId);
      } catch (error: any) {
        console.error(`Erro ao fechar sessão ${sessionId}:`, error.message);
      }
    });

    await Promise.allSettled(cleanupPromises);
    
    // Limpar o Map
    this.sessions.clear();
    
    console.log(`🧹 Cleanup concluído: ${sessionIds.length} sessões processadas`);
  }
}

export default SessionManager;
