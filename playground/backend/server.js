import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import http from 'http';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import { newPage } from '@felinto-dev/felinto-connect-bot';

const app = express();
const port = 3001;

// Get current directory for ES modules
const __dirname = dirname(fileURLToPath(import.meta.url));

// Configure marked options
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
  sanitize: false, // Allow HTML
  smartypants: true, // Use smart quotes
});

// Middleware
app.use(cors());
app.use(express.json());

// HTTP Server
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

// Store active connections
const clients = new Set();

// Function to detect possible Chrome endpoints
function detectPossibleEndpoints() {
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
wss.on('connection', (ws) => {
  console.log('Cliente conectado via WebSocket');
  clients.add(ws);

  ws.on('close', () => {
    console.log('Cliente desconectado');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('Erro WebSocket:', error);
    clients.delete(ws);
  });
});

// Broadcast function
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Documentation endpoint
app.get('/api/docs', (req, res) => {
  try {
    const readmePath = join(__dirname, '../README.md');
    const readmeContent = readFileSync(readmePath, 'utf-8');
    const htmlContent = marked.parse(readmeContent);
    
    res.json({ 
      content: htmlContent,
      markdown: readmeContent,
      lastModified: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao ler README.md:', error);
    res.status(500).json({ 
      error: 'Não foi possível carregar a documentação',
      details: error.message 
    });
  }
});

// Check Chrome connection endpoint
app.get('/api/chrome/check', async (req, res) => {
  try {
    broadcast({ type: 'info', message: 'Verificando conexão com Chrome...' });
    
    // Multiple endpoints to try (detected dynamically)
    const endpoints = detectPossibleEndpoints();
    broadcast({ type: 'info', message: `📍 Endpoints detectados: ${endpoints.join(', ')}` });
    
    let successEndpoint = null;
    let chromeInfo = null;
    let lastError = null;

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
        
      } catch (error) {
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

  } catch (error) {
    broadcast({ type: 'error', message: `❌ Erro ao verificar Chrome: ${error.message}` });
    res.status(500).json({ error: error.message });
  }
});

// Store detected endpoint globally
let detectedChromeEndpoint = null;

// Execute session endpoint
app.post('/api/execute', async (req, res) => {
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
    const sessionConfig = {
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

  } catch (error) {
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

// Generate code endpoint
app.post('/api/generate-code', (req, res) => {
  try {
    const config = req.body;
    
    // Generate TypeScript/JavaScript code
    const code = `import { newPage } from '@felinto-dev/felinto-connect-bot';

// Configuração da sessão
const config = ${JSON.stringify(config, null, 2)};

// Criar página
const page = await newPage({
  ...config,
  browserWSEndpoint: 'ws://host.docker.internal:9222' // Chrome no host
});

console.log('✅ Sessão iniciada!');
console.log('URL atual:', await page.url());
console.log('Título:', await page.title());

// Suas automações aqui...
// await page.click('#botao');
// await page.type('#input', 'texto');
// await page.screenshot({ path: 'screenshot.png' });

// Fechar (opcional)
// await page.close();`;

    res.json({ code });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
server.listen(port, () => {
  console.log(`\n🚀 Playground Backend rodando em http://localhost:${port}`);
  console.log(`📡 WebSocket disponível em ws://localhost:${port}/ws`);
  console.log(`\n📋 Endpoints disponíveis:`);
  console.log(`   GET  /api/health - Health check`);
  console.log(`   GET  /api/docs - Documentação (README.md)`);
  console.log(`   GET  /api/chrome/check - Verificar Chrome`);
  console.log(`   POST /api/execute - Executar sessão`);
  console.log(`   POST /api/generate-code - Gerar código`);
  console.log(`\n💡 Para usar o playground:`);
  console.log(`   1. Execute no terminal do host:`);
  console.log(`      google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug`);
  console.log(`   2. Acesse o playground em http://localhost:3000`);
});
