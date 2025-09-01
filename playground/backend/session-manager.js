import { v4 as uuidv4 } from 'uuid';
import vm from 'vm';
import { newPage } from '@felinto-dev/felinto-connect-bot';

class SessionManager {
  constructor(broadcastFn = null) {
    this.sessions = new Map();
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
  async createSession(config, broadcastFn) {
    const sessionId = uuidv4();
    
    try {
      broadcastFn({ type: 'info', message: `🆔 Criando sessão: ${sessionId}` });
      
      // Criar página usando a configuração fornecida
      const page = await newPage(config);
      
      const session = {
        id: sessionId,
        page,
        config,
        createdAt: new Date(),
        lastUsed: new Date(),
        executionCount: 0
      };
      
      this.sessions.set(sessionId, session);
      
      broadcastFn({ type: 'success', message: `✅ Sessão criada: ${sessionId}` });
      
      return session;
    } catch (error) {
      broadcastFn({ type: 'error', message: `❌ Erro ao criar sessão: ${error.message}` });
      throw error;
    }
  }

  /**
   * Obter sessão existente
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastUsed = new Date();
    }
    return session;
  }

  /**
   * Executar código JavaScript no contexto da página
   */
  async executeCode(sessionId, code, broadcastFn) {
    const session = this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Sessão não encontrada: ${sessionId}`);
    }

    try {
      session.executionCount++;
      broadcastFn({ type: 'info', message: `🚀 Executando código (execução #${session.executionCount})...` });
      
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
          executionCount: session.executionCount
        }
      });
      
      return { result, pageInfo };
      
    } catch (error) {
      broadcastFn({ 
        type: 'error', 
        message: `❌ Erro na execução: ${error.message}` 
      });
      throw error;
    }
  }

  /**
   * Criar contexto seguro para execução de código
   */
  createSecureContext(page, broadcastFn) {
    // Console customizado que envia logs via WebSocket
    const customConsole = {
      log: (...args) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        broadcastFn({ type: 'log', message: `📝 ${message}` });
      },
      error: (...args) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        broadcastFn({ type: 'error', message: `🔴 ${message}` });
      },
      warn: (...args) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        broadcastFn({ type: 'warning', message: `⚠️ ${message}` });
      },
      info: (...args) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        broadcastFn({ type: 'info', message: `ℹ️ ${message}` });
      }
    };

    // Contexto com apenas APIs seguras
    return {
      page,
      console: customConsole,
      // Utilitários seguros
      setTimeout: (fn, delay) => setTimeout(fn, Math.min(delay, 5000)), // Max 5s
      // Bloquear APIs perigosas
      require: undefined,
      process: undefined,
      global: undefined,
      Buffer: undefined,
      __dirname: undefined,
      __filename: undefined
    };
  }

  /**
   * Executar código com timeout
   */
  async executeWithTimeout(code, context, timeout) {
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
          displayErrors: true
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
        
      } catch (error) {
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
  async getPageInfo(page) {
    try {
      const [url, title] = await Promise.all([
        page.url(),
        page.title()
      ]);
      
      return {
        url,
        title,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        url: 'Erro ao capturar URL',
        title: 'Erro ao capturar título',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Capturar screenshot da página
   */
  async takeScreenshot(sessionId, options = {}) {
    const session = this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Sessão não encontrada: ${sessionId}`);
    }

    try {
      const screenshot = await session.page.screenshot({
        type: 'png',
        encoding: 'base64',
        fullPage: false,
        ...options
      });
      
      return screenshot;
    } catch (error) {
      throw new Error(`Erro ao capturar screenshot: ${error.message}`);
    }
  }

  /**
   * Remover sessão
   */
  async removeSession(sessionId, broadcastFn) {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      try {
        // Fechar página
        if (session.page && !session.page.isClosed()) {
          await session.page.close();
        }
        
        this.sessions.delete(sessionId);
        
        if (broadcastFn) {
          broadcastFn({ type: 'info', message: `🗑️ Sessão removida: ${sessionId}` });
        }
        
        return true;
      } catch (error) {
        if (broadcastFn) {
          broadcastFn({ type: 'error', message: `❌ Erro ao remover sessão: ${error.message}` });
        }
        throw error;
      }
    }
    
    return false;
  }

  /**
   * Limpeza automática de sessões inativas
   */
  cleanupInactiveSessions(broadcastFn = null) {
    const now = new Date();
    const sessionsToRemove = [];
    
    for (const [sessionId, session] of this.sessions) {
      const timeSinceLastUse = now - session.lastUsed;
      
      if (timeSinceLastUse > this.sessionTimeout) {
        sessionsToRemove.push({ sessionId, session });
      }
    }
    
    // Remover sessões inativas
    sessionsToRemove.forEach(({ sessionId, session }) => {
      this.removeSession(sessionId);
      console.log(`🧹 Sessão inativa removida: ${sessionId}`);
      
      // Notificar via WebSocket se função de broadcast disponível
      if (broadcastFn) {
        broadcastFn({
          type: 'session_expired',
          message: `🕐 Sessão ${sessionId.substring(0, 8)}... expirou por inatividade (${Math.round(this.sessionTimeout / 60000)} min)`,
          sessionId: sessionId
        });
      }
    });
  }

  /**
   * Obter estatísticas das sessões
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => (new Date() - s.lastUsed) < 60000).length, // Ativas nos últimos 60s
      totalExecutions: sessions.reduce((sum, s) => sum + s.executionCount, 0),
      oldestSession: sessions.length > 0 ? Math.min(...sessions.map(s => s.createdAt)) : null
    };
  }
}

export default SessionManager;
