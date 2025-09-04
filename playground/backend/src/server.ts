import express, { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import http from 'http';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import { newPage } from '@felinto-dev/felinto-connect-bot';
import SessionManager from './session-manager.js';
import { BroadcastMessage, SessionConfig } from './types.js';

const app = express();
// SessionManager será inicializado após a função broadcast estar disponível
let sessionManager: SessionManager;
const port = 3001;

// Get current directory for ES modules
const __dirname = dirname(fileURLToPath(import.meta.url));

// Configure marked options
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
});

// Middleware
app.use(cors());
app.use(express.json());

// HTTP Server
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

// Store active connections
const clients = new Set<WebSocket>();

// Function to detect possible Chrome endpoints
function detectPossibleEndpoints(): string[] {
  const endpoints = [
    'docker.for.mac.localhost:9222', // Funciona melhor no macOS com Docker Desktop
    'host.docker.internal:9222',
    'localhost:9222',
    '127.0.0.1:9222'
  ];
  
  try {
    // Try to get gateway IP
    const gatewayIP = execSync('ip route show | grep default | awk \'{print $3}\' 2>/dev/null', {
      encoding: 'utf8',
      timeout: 2000
    }).trim();
    
    if (gatewayIP && gatewayIP !== '127.0.0.1') {
      endpoints.splice(1, 0, `${gatewayIP}:9222`); // Add after host.docker.internal
    }
  } catch (error) {
    // Fallback to common Docker gateway
    endpoints.splice(1, 0, '172.17.0.1:9222');
  }
  
  return endpoints;
}

// WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
  console.log('Cliente conectado via WebSocket');
  clients.add(ws);

  ws.on('close', () => {
    console.log('Cliente desconectado');
    clients.delete(ws);
  });

  ws.on('error', (error: Error) => {
    console.error('Erro WebSocket:', error);
    clients.delete(ws);
  });
});

// Broadcast function
function broadcast(message: BroadcastMessage) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Initialize SessionManager with broadcast function
sessionManager = new SessionManager(broadcast);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Documentation endpoint
app.get('/api/docs', (req: Request, res: Response) => {
  try {
    const readmePath = join(__dirname, '../../README.md');
    const readmeContent = readFileSync(readmePath, 'utf-8');
    const htmlContent = marked.parse(readmeContent);
    
    res.json({ 
      content: htmlContent,
      markdown: readmeContent,
      lastModified: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erro ao ler README.md:', error);
    res.status(500).json({ 
      error: 'Não foi possível carregar a documentação',
      details: error.message 
    });
  }
});

// Check Chrome connection endpoint
app.get('/api/chrome/check', async (req: Request, res: Response) => {
  try {
    broadcast({ type: 'info', message: 'Verificando conexão com Chrome...' });
    
    // Multiple endpoints to try (detected dynamically)
    const endpoints = detectPossibleEndpoints();
    broadcast({ type: 'info', message: `📍 Endpoints detectados: ${endpoints.join(', ')}` });
    
    let successEndpoint: string | null = null;
    let chromeInfo: any = null;
    let lastError: string | null = null;

    // Try each endpoint
    for (const endpoint of endpoints) {
      try {
        broadcast({ type: 'info', message: `🔍 Testando ${endpoint}...` });
        
        const response = await fetch(`http://${endpoint}/json/version`, {
          signal: AbortSignal.timeout(2000)
        });
        
        if (response.ok) {
          chromeInfo = await response.json();
          successEndpoint = endpoint;
          broadcast({ type: 'success', message: `✅ Chrome encontrado em ${endpoint}! A flag --remote-debugging-address=0.0.0.0 está funcionando!` });
          break;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        
      } catch (error: any) {
        lastError = error.message;
        broadcast({ type: 'info', message: `❌ ${endpoint}: ${error.message}` });
        continue;
      }
    }

    if (successEndpoint) {
      // Cache the detected endpoint
      detectedChromeEndpoint = `ws://${successEndpoint}`;
      
      res.json({ 
        available: true, 
        endpoint: `ws://${successEndpoint}`,
        chromeVersion: chromeInfo.Browser,
        detectedAt: successEndpoint
      });
    } else {
      broadcast({ 
        type: 'warning', 
        message: '⚠️ Chrome não detectado em nenhum endpoint' 
      });
      
      // Platform-specific instructions
      const isMac = process.platform === 'darwin' || req.headers['user-agent']?.includes('Mac');
      const instructions = isMac 
        ? 'Execute no terminal do host (macOS): /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --disable-web-security --disable-features=VizDisplayCompositor'
        : 'Execute no terminal do host: google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --disable-web-security';
      
      res.json({ 
        available: false, 
        error: lastError,
        testedEndpoints: endpoints,
        instructions,
        troubleshooting: isMac ? [
          '1. ESSENCIAL: Use --remote-debugging-address=0.0.0.0 para permitir conexões do container',
          '2. Certifique-se de que o Chrome está rodando no macOS (host)',
          '3. Verifique permissões: Ajustes > Privacidade e Segurança > Rede Local',
          '4. Desative firewall temporariamente para testar',
          '5. Tente reiniciar o Docker Desktop se necessário'
        ] : [
          '1. ESSENCIAL: Use --remote-debugging-address=0.0.0.0 para permitir conexões do container',
          '2. Execute o comando de inicialização do Chrome no host',
          '3. Verifique se a porta 9222 não está em uso',
          '4. Tente com --disable-web-security se necessário'
        ]
      });
    }

  } catch (error: any) {
    broadcast({ type: 'error', message: `❌ Erro ao verificar Chrome: ${error.message}` });
    res.status(500).json({ error: error.message });
  }
});

// Store detected endpoint globally
let detectedChromeEndpoint: string | null = null;

// Execute session endpoint
app.post('/api/execute', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    
    broadcast({ type: 'info', message: '🚀 Iniciando nova sessão...' });
    
    // Get the latest Chrome endpoint
    let chromeEndpoint = detectedChromeEndpoint;
    
    // If not cached, try to detect again
    if (!chromeEndpoint) {
      broadcast({ type: 'info', message: '🔍 Detectando Chrome...' });
      const endpoints = detectPossibleEndpoints();
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`http://${endpoint}/json/version`, {
            signal: AbortSignal.timeout(2000)
          });
          if (response.ok) {
            chromeEndpoint = `ws://${endpoint}`;
            detectedChromeEndpoint = chromeEndpoint;
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    if (!chromeEndpoint) {
      throw new Error('Chrome não detectado. Execute o comando de inicialização do Chrome no host.');
    }
    
    broadcast({ type: 'info', message: `🔗 Usando endpoint: ${chromeEndpoint}` });
    
    // Force connection to detected Chrome endpoint
    const sessionConfig: SessionConfig = {
      ...config,
      browserWSEndpoint: chromeEndpoint,
      // Add debug logging
      $debug: true
    };

    broadcast({ type: 'info', message: `📋 Configuração: ${JSON.stringify(sessionConfig, null, 2)}` });

    // Create page
    broadcast({ type: 'info', message: '🔗 Conectando ao Chrome...' });
    const page = await newPage(sessionConfig);

    broadcast({ type: 'success', message: '✅ Página criada com sucesso!' });
    broadcast({ type: 'info', message: '🌐 Chrome aberto e configurado' });

    // Get page info
    const url = await page.url();
    const title = await page.title();

    broadcast({ 
      type: 'success', 
      message: `📍 Página atual: ${title || 'Sem título'} - ${url}` 
    });

    res.json({ 
      success: true, 
      message: 'Sessão iniciada com sucesso!',
      pageInfo: {
        url,
        title,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Erro ao executar sessão:', error);
    
    let errorMessage = error.message;
    
    // Melhorar mensagens de erro para problemas de conexão Chrome
    if (error.message.includes('Failed to connect to browser') || error.message.includes('ECONNREFUSED')) {
      errorMessage = `❌ Erro de conexão com Chrome: Verifique se o Chrome está rodando com debug habilitado na porta 9222`;
      broadcast({ type: 'info', message: '💡 Execute o comando: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0' });
    } else if (error.message.includes('Unexpected server response: 404')) {
      errorMessage = `❌ Chrome não encontrado: Verifique se foi iniciado com as flags corretas`;
      broadcast({ type: 'info', message: '💡 Certifique-se de usar --remote-debugging-address=0.0.0.0' });
    }
    
    broadcast({ 
      type: 'error', 
      message: errorMessage
    });
    
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Create new session endpoint
app.post('/api/session/create', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    
    // Get the latest Chrome endpoint
    let chromeEndpoint = detectedChromeEndpoint;
    
    // If not cached, try to detect again
    if (!chromeEndpoint) {
      broadcast({ type: 'info', message: '🔍 Detectando Chrome...' });
      const endpoints = detectPossibleEndpoints();
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`http://${endpoint}/json/version`, {
            signal: AbortSignal.timeout(2000)
          });
          if (response.ok) {
            chromeEndpoint = `ws://${endpoint}`;
            detectedChromeEndpoint = chromeEndpoint;
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    if (!chromeEndpoint) {
      throw new Error('Chrome não detectado. Execute o comando de inicialização do Chrome no host.');
    }
    
    // Force connection to detected Chrome endpoint
    const sessionConfig: SessionConfig = {
      ...config,
      browserWSEndpoint: chromeEndpoint,
      $debug: true
    };



    const session = await sessionManager.createSession(sessionConfig, broadcast);
    
    // Get initial page info
    const pageInfo = await sessionManager.getPageInfo(session.page);
    
    res.json({ 
      success: true, 
      sessionId: session.id,
      message: 'Sessão criada com sucesso!',
      pageInfo
    });

  } catch (error: any) {
    console.error('Erro ao criar sessão:', error);
    
    broadcast({ 
      type: 'error', 
      message: `❌ Erro ao criar sessão: ${error.message}`
    });
    
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Execute code in existing session
app.post('/api/session/execute', async (req: Request, res: Response) => {
  try {
    const { sessionId, code } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId é obrigatório' });
    }
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code é obrigatório e deve ser uma string' });
    }

    const result = await sessionManager.executeCode(sessionId, code, broadcast);
    
    res.json({ 
      success: true, 
      message: 'Código executado com sucesso!',
      ...result
    });

  } catch (error: any) {
    console.error('Erro ao executar código:', error);
    
    // Verificar se é erro de sessão não encontrada
    if (error.message.includes('Sessão não encontrada')) {
      const sessionId = req.body.sessionId;
      broadcast({ 
        type: 'session_expired', 
        message: `❌ Sessão expirou ou foi removida. Crie uma nova sessão.`,
        sessionId: sessionId
      });
      
      res.status(404).json({ 
        error: 'Sessão não encontrada',
        sessionExpired: true,
        message: 'A sessão expirou ou foi removida. Crie uma nova sessão.'
      });
    } else {
      broadcast({ 
        type: 'error', 
        message: `❌ Erro na execução: ${error.message}`
      });
      
      res.status(500).json({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

// Take screenshot of session
app.post('/api/session/screenshot', async (req: Request, res: Response) => {
  try {
    const { sessionId, options = {} } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId é obrigatório' });
    }

    broadcast({ type: 'info', message: `📸 Capturando screenshot da sessão: ${sessionId}` });
    
    const screenshot = await sessionManager.takeScreenshot(sessionId, options);
    
    broadcast({ type: 'success', message: '✅ Screenshot capturado!' });
    
    res.json({ 
      success: true, 
      screenshot: `data:image/png;base64,${screenshot}`,
      message: 'Screenshot capturado com sucesso!'
    });

  } catch (error: any) {
    console.error('Erro ao capturar screenshot:', error);
    
    // Verificar se é erro de sessão não encontrada
    if (error.message.includes('Sessão não encontrada')) {
      const sessionId = req.body.sessionId;
      broadcast({ 
        type: 'session_expired', 
        message: `❌ Sessão expirou ou foi removida. Crie uma nova sessão.`,
        sessionId: sessionId
      });
      
      res.status(404).json({ 
        error: 'Sessão não encontrada',
        sessionExpired: true,
        message: 'A sessão expirou ou foi removida. Crie uma nova sessão.'
      });
    } else {
      broadcast({ 
        type: 'error', 
        message: `❌ Erro ao capturar screenshot: ${error.message}`
      });
      
      res.status(500).json({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

// Remove session
app.delete('/api/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const removed = await sessionManager.removeSession(sessionId, broadcast);
    
    if (removed) {
      res.json({ 
        success: true, 
        message: 'Sessão removida com sucesso!' 
      });
    } else {
      res.status(404).json({ 
        error: 'Sessão não encontrada' 
      });
    }

  } catch (error: any) {
    console.error('Erro ao remover sessão:', error);
    
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get session stats
app.get('/api/sessions/stats', (req: Request, res: Response) => {
  try {
    const stats = sessionManager.getStats();
    
    res.json({ 
      success: true, 
      stats 
    });

  } catch (error: any) {
    console.error('Erro ao obter estatísticas:', error);
    
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Recebido sinal ${signal}. Iniciando shutdown gracioso...`);
  
  try {
    // 1. Parar de aceitar novas conexões
    console.log('📡 Fechando servidor HTTP...');
    server.close(() => {
      console.log('✅ Servidor HTTP fechado');
    });

    // 2. Fechar todas as conexões WebSocket
    console.log('🔌 Fechando conexões WebSocket...');
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutdown');
      }
    });
    clients.clear();
    console.log('✅ Conexões WebSocket fechadas');

    // 3. Fechar todas as sessões ativas
    if (sessionManager) {
      console.log('🧹 Limpando sessões ativas...');
      const stats = sessionManager.getStats();
      if (stats.totalSessions > 0) {
        console.log(`📊 Fechando ${stats.totalSessions} sessões ativas...`);
        await sessionManager.cleanup();
        console.log('✅ Sessões fechadas');
      }
    }

    console.log('🎯 Shutdown gracioso concluído');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante shutdown:', error);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
server.listen(port, () => {
  console.log(`\n🚀 Playground Backend rodando em http://localhost:${port}`);
  console.log(`📡 WebSocket disponível em ws://localhost:${port}/ws`);
  console.log(`\n📋 Endpoints disponíveis:`);
  console.log(`   GET  /api/health - Health check`);
  console.log(`   GET  /api/docs - Documentação (README.md)`);
  console.log(`   GET  /api/chrome/check - Verificar Chrome`);
  console.log(`   POST /api/execute - Executar sessão (legacy)`);
  console.log(`   POST /api/session/create - Criar nova sessão`);
  console.log(`   POST /api/session/execute - Executar código na sessão`);
  console.log(`   POST /api/session/screenshot - Capturar screenshot`);
  console.log(`   DELETE /api/session/:id - Remover sessão`);
  console.log(`   GET  /api/sessions/stats - Estatísticas das sessões`);

  console.log(`\n💡 Para usar o playground:`);
  console.log(`   1. Execute no terminal do host:`);
  console.log(`      google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug`);
  console.log(`   2. Acesse o playground em http://localhost:3000`);
  console.log(`\n🔧 Para parar o servidor: Ctrl+C (shutdown gracioso habilitado)`);
});
