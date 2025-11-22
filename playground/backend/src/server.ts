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
import { RecordingService } from './recording/RecordingService.js';
import { ExportService } from './recording/ExportService.js';
import { PlaybackService } from './recording/PlaybackService.js';
import { 
  BroadcastMessage, 
  SessionConfig,
  RecordingConfig,
  RecordingData,
  RecordingStatus,
  StartRecordingResponse,
  StopRecordingResponse,
  PauseRecordingResponse,
  RecordingStatusResponse,
  ExportOptions,
  ExportResult,
  PlaybackConfig,
  PlaybackStatus
} from './types.js';

const app = express();
// SessionManager será inicializado após a função broadcast estar disponível
let sessionManager: SessionManager;
const port = 3001;

// Store para gravações ativas
const activeRecordings = new Map<string, RecordingData>();
// Store para serviços de gravação ativos
const activeRecordingServices = new Map<string, RecordingService>();
// Store para serviços de reprodução ativos
const activePlaybackServices = new Map<string, PlaybackService>();

// Função para gerar ID único de gravação
function generateRecordingId(): string {
  return `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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

// Broadcast function with retry mechanism for better reliability
function broadcast(message: BroadcastMessage) {
  const data = JSON.stringify(message);
  let sentCount = 0;
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      sentCount++;
    }
  });
  
  // If no clients received the message and it's an important message, retry after a short delay
  if (sentCount === 0 && (message.type === 'success' || message.type === 'error')) {
    setTimeout(() => {
      let retrySentCount = 0;
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
          retrySentCount++;
        }
      });
    }, 100); // 100ms delay for retry
  }
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
    
    // Determinar o tipo de imagem baseado nas opções
    const imageType = options.quality ? 'jpeg' : 'png';
    
    res.json({ 
      success: true, 
      screenshot: `data:image/${imageType};base64,${screenshot}`,
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

// ==========================================
// ENDPOINT DE VALIDAÇÃO DE SESSÃO
// ==========================================

// Validate session endpoint
app.get('/api/session/:sessionId/validate', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId é obrigatório'
      });
    }

    // Verificar se a sessão existe e ainda é válida
    const isValid = await sessionManager.isSessionValid(sessionId);
    
    if (isValid) {
      const session = sessionManager.getSession(sessionId);
      const pageInfo = session ? await sessionManager.getPageInfo(session.page) : null;
      
      res.json({
        success: true,
        valid: true,
        sessionId,
        pageInfo
      });
    } else {
      res.status(404).json({
        success: false,
        valid: false,
        error: 'Sessão não encontrada ou inválida',
        sessionExpired: true
      });
    }

  } catch (error: any) {
    console.error('Erro ao validar sessão:', error);
    
    res.status(500).json({
      success: false,
      valid: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==========================================
// ENDPOINTS DE GRAVAÇÃO
// ==========================================

// Start recording
app.post('/api/recording/start', async (req: Request, res: Response) => {
  try {
    const { sessionId, config } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false,
        error: 'sessionId é obrigatório' 
      });
    }

    // Verificar se a sessão existe
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sessão não encontrada',
        sessionExpired: true
      });
    }

    // Verificar se já existe gravação ativa para esta sessão
    const existingRecording = Array.from(activeRecordings.values())
      .find(rec => rec.sessionId === sessionId && rec.status === 'recording');
    
    if (existingRecording) {
      return res.status(409).json({
        success: false,
        error: 'Já existe uma gravação ativa para esta sessão',
        recordingId: existingRecording.id
      });
    }

    // Gerar ID da gravação
    const recordingId = generateRecordingId();
    
    // Configuração padrão da gravação (otimizada)
    const recordingConfig: RecordingConfig = {
      sessionId,
      events: config?.events || ['click', 'navigation', 'form_submit', 'form_focus', 'form_input_change', 'form_navigation'],
      mode: config?.mode || 'smart',
      delay: config?.delay || 300, // Reduzido para melhor responsividade
      captureScreenshots: config?.captureScreenshots || false,
      screenshotInterval: config?.screenshotInterval || 5000,
      maxDuration: config?.maxDuration,
      maxEvents: config?.maxEvents || 1500 // Aumentado para suportar mais eventos
    };

    // Obter informações da página atual
    const pageUrl = await session.page.url();
    const pageTitle = await session.page.title();
    const viewport = await session.page.viewport();

    // Criar dados da gravação
    const recordingData: RecordingData = {
      id: recordingId,
      sessionId,
      config: recordingConfig,
      events: [],
      startTime: Date.now(),
      status: 'recording' as RecordingStatus,
      metadata: {
        userAgent: await session.page.evaluate(() => navigator.userAgent),
        viewport: viewport ? { width: viewport.width, height: viewport.height } : undefined,
        initialUrl: pageUrl,
        totalEvents: 0,
        totalScreenshots: 0
      }
    };

    // Armazenar gravação ativa
    activeRecordings.set(recordingId, recordingData);

    // Criar e iniciar serviço de gravação
    const recordingService = new RecordingService(session.page, recordingData, broadcast);
    activeRecordingServices.set(recordingId, recordingService);

    // Iniciar captura de eventos
    await recordingService.startCapture();

    console.log(`🔴 Gravação iniciada: ${recordingId} para sessão: ${sessionId}`);

    const response: StartRecordingResponse = {
      recordingId,
      sessionId,
      message: 'Gravação iniciada com sucesso!',
      config: recordingConfig
    };

    res.json({
      success: true,
      ...response
    });

  } catch (error: any) {
    console.error('Erro ao iniciar gravação:', error);
    
    broadcast({
      type: 'error',
      message: `❌ Erro ao iniciar gravação: ${error.message}`
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Stop recording
app.post('/api/recording/stop', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.body;
    
    if (!recordingId) {
      return res.status(400).json({
        success: false,
        error: 'recordingId é obrigatório'
      });
    }

    const recording = activeRecordings.get(recordingId);
    const recordingService = activeRecordingServices.get(recordingId);
    
    if (!recording || !recordingService) {
      return res.status(404).json({
        success: false,
        error: 'Gravação não encontrada'
      });
    }

    // Parar captura de eventos
    await recordingService.stopCapture();

    // Atualizar dados da gravação
    const updatedRecording = recordingService.getRecordingData();
    const endTime = Date.now();
    updatedRecording.status = 'stopped';
    updatedRecording.endTime = endTime;
    updatedRecording.duration = endTime - updatedRecording.startTime;
    updatedRecording.metadata.totalEvents = updatedRecording.events.length;

    // Atualizar no store
    activeRecordings.set(recordingId, updatedRecording);
    
    // Remover serviço ativo
    activeRecordingServices.delete(recordingId);

    // Calcular estatísticas
    const eventsByType: Record<string, number> = {};
    let screenshotCount = 0;

    updatedRecording.events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      if (event.screenshot) screenshotCount++;
    });

    const stats = {
      totalEvents: updatedRecording.events.length,
      eventsByType,
      duration: updatedRecording.duration || 0,
      averageEventInterval: updatedRecording.events.length > 1 ? 
        (updatedRecording.duration || 0) / (updatedRecording.events.length - 1) : 0,
      screenshotCount
    };

    console.log(`⏹️ Gravação finalizada: ${recordingId} - ${stats.totalEvents} eventos`);

    const response: StopRecordingResponse = {
      recordingId,
      message: 'Gravação finalizada com sucesso!',
      stats,
      recording: updatedRecording
    };

    res.json({
      success: true,
      ...response
    });

  } catch (error: any) {
    console.error('Erro ao parar gravação:', error);
    
    broadcast({
      type: 'error',
      message: `❌ Erro ao parar gravação: ${error.message}`
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Pause/Resume recording
app.post('/api/recording/pause', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.body;
    
    if (!recordingId) {
      return res.status(400).json({
        success: false,
        error: 'recordingId é obrigatório'
      });
    }

    const recording = activeRecordings.get(recordingId);
    const recordingService = activeRecordingServices.get(recordingId);
    
    if (!recording || !recordingService) {
      return res.status(404).json({
        success: false,
        error: 'Gravação não encontrada'
      });
    }

    const currentTime = Date.now();
    let newStatus: RecordingStatus;
    let message: string;
    let pausedAt: number | undefined;
    let resumedAt: number | undefined;

    if (recording.status === 'recording') {
      // Pausar gravação
      recordingService.pauseCapture();
      newStatus = 'paused';
      message = 'Gravação pausada';
      pausedAt = currentTime;
    } else if (recording.status === 'paused') {
      // Resumir gravação
      recordingService.resumeCapture();
      newStatus = 'recording';
      message = 'Gravação resumida';
      resumedAt = currentTime;
    } else {
      return res.status(400).json({
        success: false,
        error: `Não é possível pausar/resumir gravação com status: ${recording.status}`
      });
    }

    // Atualizar status no store
    recording.status = newStatus;
    activeRecordings.set(recordingId, recording);

    // Broadcast status
    broadcast({
      type: 'recording_status',
      message: `${newStatus === 'paused' ? '⏸️' : '▶️'} ${message}: ${recordingId}`,
      sessionId: recording.sessionId,
      recordingId,
      data: { status: newStatus, recordingId }
    });

    console.log(`${newStatus === 'paused' ? '⏸️' : '▶️'} ${message}: ${recordingId}`);

    const response: PauseRecordingResponse = {
      recordingId,
      message,
      status: newStatus,
      pausedAt,
      resumedAt
    };

    res.json({
      success: true,
      ...response
    });

  } catch (error: any) {
    console.error('Erro ao pausar/resumir gravação:', error);
    
    broadcast({
      type: 'error',
      message: `❌ Erro ao pausar/resumir gravação: ${error.message}`
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get recording status
app.get('/api/recording/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId é obrigatório'
      });
    }

    // Buscar gravação ativa para a sessão
    const recording = Array.from(activeRecordings.values())
      .find(rec => rec.sessionId === sessionId);

    if (!recording) {
      return res.json({
        success: true,
        recordingId: null,
        status: 'idle' as RecordingStatus,
        stats: {
          totalEvents: 0,
          eventsByType: {},
          duration: 0,
          averageEventInterval: 0,
          screenshotCount: 0
        },
        isActive: false
      });
    }

    // Calcular estatísticas atuais
    const eventsByType: Record<string, number> = {};
    let screenshotCount = 0;

    recording.events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      if (event.screenshot) screenshotCount++;
    });

    const currentTime = Date.now();
    const duration = recording.status === 'stopped' ? 
      (recording.duration || 0) : 
      (currentTime - recording.startTime);

    const stats = {
      totalEvents: recording.events.length,
      eventsByType,
      duration,
      averageEventInterval: recording.events.length > 1 ? 
        duration / (recording.events.length - 1) : 0,
      screenshotCount
    };

    const response: RecordingStatusResponse = {
      recordingId: recording.id,
      status: recording.status,
      stats,
      currentEvent: recording.events[recording.events.length - 1],
      isActive: recording.status === 'recording' || recording.status === 'paused'
    };

    res.json({
      success: true,
      ...response
    });

  } catch (error: any) {
    console.error('Erro ao obter status da gravação:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==========================================
// ENDPOINTS DE PREVIEW
// ==========================================

// Capturar screenshot da sessão ativa
app.post('/api/recording/screenshot/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { quality = 80, fullPage = false } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId é obrigatório'
      });
    }

    // Verificar se a sessão existe
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sessão não encontrada',
        sessionExpired: true
      });
    }

    // Verificar se a sessão ainda está ativa
    const isValid = await sessionManager.isSessionValid(sessionId);
    if (!isValid) {
      return res.status(404).json({
        success: false,
        error: 'Sessão foi fechada ou não está mais ativa',
        sessionExpired: true
      });
    }

    console.log(`📸 Capturando screenshot da sessão: ${sessionId}`);
    
    // Capturar screenshot
    const screenshot = await session.page.screenshot({
      type: 'jpeg',
      encoding: 'base64',
      fullPage,
      quality: Math.min(Math.max(quality, 10), 100) // Limitar entre 10-100
    });

    // Obter informações da página
    const pageUrl = await session.page.url();
    const pageTitle = await session.page.title();
    const viewport = await session.page.viewport();

    const response = {
      success: true,
      screenshot: `data:image/jpeg;base64,${screenshot}`,
      metadata: {
        url: pageUrl,
        title: pageTitle,
        viewport,
        timestamp: Date.now(),
        quality,
        fullPage,
        size: Math.round((screenshot.length * 3) / 4 / 1024) // Tamanho aproximado em KB
      }
    };

    res.json(response);

    console.log(`✅ Screenshot capturado: ${response.metadata.size}KB`);

  } catch (error: any) {
    console.error('❌ Erro ao capturar screenshot:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obter último screenshot/preview da sessão
app.get('/api/recording/preview/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId é obrigatório'
      });
    }

    // Verificar se a sessão existe
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sessão não encontrada',
        sessionExpired: true
      });
    }

    // Verificar se a sessão ainda está ativa
    const isValid = await sessionManager.isSessionValid(sessionId);
    if (!isValid) {
      return res.status(404).json({
        success: false,
        error: 'Sessão foi fechada ou não está mais ativa',
        sessionExpired: true
      });
    }

    // Capturar screenshot atual (preview rápido)
    const screenshot = await session.page.screenshot({
      type: 'jpeg',
      encoding: 'base64',
      fullPage: false,
      quality: 60 // Qualidade menor para preview rápido
    });

    // Obter informações básicas da página
    const pageUrl = await session.page.url();
    const pageTitle = await session.page.title();

    const response = {
      success: true,
      preview: `data:image/jpeg;base64,${screenshot}`,
      metadata: {
        url: pageUrl,
        title: pageTitle,
        timestamp: Date.now(),
        isPreview: true
      }
    };

    res.json(response);

  } catch (error: any) {
    console.error('❌ Erro ao obter preview:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obter informações da página atual da sessão
app.get('/api/recording/page-info/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId é obrigatório'
      });
    }

    // Verificar se a sessão existe
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sessão não encontrada',
        sessionExpired: true
      });
    }

    // Obter informações detalhadas da página
    const pageUrl = await session.page.url();
    const pageTitle = await session.page.title();
    const viewport = await session.page.viewport();

    // Obter métricas de performance se disponível
    let metrics = null;
    try {
      const performanceMetrics = await session.page.metrics();
      metrics = performanceMetrics;
    } catch (error) {
      // Métricas podem não estar disponíveis em alguns casos
    }

    const response = {
      success: true,
      pageInfo: {
        url: pageUrl,
        title: pageTitle,
        viewport,
        timestamp: Date.now(),
        metrics
      }
    };

    res.json(response);

  } catch (error: any) {
    console.error('❌ Erro ao obter informações da página:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==========================================
// ENDPOINTS DE EXPORTAÇÃO
// ==========================================

// Exportar gravação
app.post('/api/recording/export', async (req: Request, res: Response) => {
  try {
    const { recordingId, options } = req.body;
    
    if (!recordingId) {
      return res.status(400).json({
        success: false,
        error: 'recordingId é obrigatório'
      });
    }

    if (!options || !options.format) {
      return res.status(400).json({
        success: false,
        error: 'options.format é obrigatório'
      });
    }

    // Buscar gravação (primeiro em ativas, depois em finalizadas)
    let recording = activeRecordings.get(recordingId);
    
    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Gravação não encontrada'
      });
    }

    // Validar opções de exportação
    try {
      ExportService.validateExportOptions(options);
    } catch (validationError: any) {
      return res.status(400).json({
        success: false,
        error: `Opções inválidas: ${validationError.message}`
      });
    }

    console.log(`📤 Iniciando exportação: ${recordingId} -> ${options.format}`);

    // Exportar gravação
    const exportResult = await ExportService.exportRecording(recording, options);

    // Broadcast sucesso
    broadcast({
      type: 'success',
      message: `📤 Exportação concluída: ${exportResult.filename}`,
      sessionId: recording.sessionId,
      recordingId,
      data: {
        format: exportResult.format,
        size: exportResult.size,
        filename: exportResult.filename
      }
    });

    res.json({
      success: true,
      ...exportResult
    });

  } catch (error: any) {
    console.error('❌ Erro ao exportar gravação:', error);
    
    broadcast({
      type: 'error',
      message: `❌ Erro na exportação: ${error.message}`
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Listar gravações disponíveis para exportação
app.get('/api/recordings', async (req: Request, res: Response) => {
  try {
    const recordings = Array.from(activeRecordings.values()).map(recording => ({
      id: recording.id,
      sessionId: recording.sessionId,
      createdAt: recording.startTime,
      duration: recording.duration,
      eventCount: recording.events.length,
      status: recording.status,
      metadata: {
        initialUrl: recording.metadata.initialUrl,
        totalEvents: recording.metadata.totalEvents
      }
    }));

    res.json({
      success: true,
      recordings,
      total: recordings.length
    });

  } catch (error: any) {
    console.error('❌ Erro ao listar gravações:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obter gravação específica
app.get('/api/recording/:recordingId', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    
    const recording = activeRecordings.get(recordingId);
    
    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Gravação não encontrada'
      });
    }

    res.json({
      success: true,
      recording
    });

  } catch (error: any) {
    console.error('❌ Erro ao obter gravação:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==========================================
// ENDPOINTS DE REPRODUÇÃO
// ==========================================

// Reproduzir gravação
app.post('/api/recording/playback/start', async (req: Request, res: Response) => {
  try {
    const { recordingId, sessionId, config } = req.body;
    
    if (!recordingId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'recordingId e sessionId são obrigatórios'
      });
    }

    // Verificar se a sessão existe
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sessão não encontrada',
        sessionExpired: true
      });
    }

    // Verificar se a gravação existe
    const recording = activeRecordings.get(recordingId);
    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Gravação não encontrada'
      });
    }

    // Verificar se já existe reprodução ativa
    if (activePlaybackServices.has(recordingId)) {
      return res.status(409).json({
        success: false,
        error: 'Reprodução já está em andamento para esta gravação'
      });
    }

    // Configuração padrão de reprodução
    const playbackConfig: PlaybackConfig = {
      speed: config?.speed || 1,
      pauseOnError: config?.pauseOnError !== false,
      skipScreenshots: config?.skipScreenshots || false,
      startFromEvent: config?.startFromEvent,
      endAtEvent: config?.endAtEvent
    };

    // Criar e iniciar serviço de reprodução
    const playbackService = new PlaybackService(session.page, recording, playbackConfig, broadcast);
    activePlaybackServices.set(recordingId, playbackService);

    // Iniciar reprodução
    await playbackService.startPlayback();

    console.log(`▶️ Reprodução iniciada para gravação: ${recordingId}`);

    res.json({
      success: true,
      message: 'Reprodução iniciada com sucesso!',
      recordingId,
      sessionId,
      config: playbackConfig,
      status: playbackService.getStatus()
    });

  } catch (error: any) {
    console.error('❌ Erro ao iniciar reprodução:', error);
    
    broadcast({
      type: 'error',
      message: `❌ Erro ao iniciar reprodução: ${error.message}`
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Controlar reprodução (pause/resume)
app.post('/api/recording/playback/control', async (req: Request, res: Response) => {
  try {
    const { recordingId, action } = req.body;
    
    if (!recordingId || !action) {
      return res.status(400).json({
        success: false,
        error: 'recordingId e action são obrigatórios'
      });
    }

    const playbackService = activePlaybackServices.get(recordingId);
    if (!playbackService) {
      return res.status(404).json({
        success: false,
        error: 'Reprodução não encontrada'
      });
    }

    let message: string;
    
    switch (action) {
      case 'pause':
        playbackService.pausePlayback();
        message = 'Reprodução pausada';
        break;
      
      case 'resume':
        playbackService.resumePlayback();
        message = 'Reprodução resumida';
        break;
      
      case 'stop':
        playbackService.stopPlayback();
        activePlaybackServices.delete(recordingId);
        message = 'Reprodução parada';
        break;
      
      default:
        return res.status(400).json({
          success: false,
          error: `Ação inválida: ${action}`
        });
    }

    res.json({
      success: true,
      message,
      recordingId,
      action,
      status: playbackService.getStatus()
    });

  } catch (error: any) {
    console.error('❌ Erro no controle de reprodução:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Navegar na reprodução
app.post('/api/recording/playback/seek', async (req: Request, res: Response) => {
  try {
    const { recordingId, eventIndex } = req.body;
    
    if (!recordingId || eventIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: 'recordingId e eventIndex são obrigatórios'
      });
    }

    const playbackService = activePlaybackServices.get(recordingId);
    if (!playbackService) {
      return res.status(404).json({
        success: false,
        error: 'Reprodução não encontrada'
      });
    }

    await playbackService.seekToEvent(eventIndex);

    res.json({
      success: true,
      message: `Navegado para evento ${eventIndex + 1}`,
      recordingId,
      eventIndex,
      status: playbackService.getStatus()
    });

  } catch (error: any) {
    console.error('❌ Erro na navegação da reprodução:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obter status da reprodução
app.get('/api/recording/playback/status/:recordingId', async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    
    const playbackService = activePlaybackServices.get(recordingId);
    
    if (!playbackService) {
      return res.json({
        success: true,
        isActive: false,
        status: null
      });
    }

    res.json({
      success: true,
      isActive: playbackService.isActive(),
      status: playbackService.getStatus()
    });

  } catch (error: any) {
    console.error('❌ Erro ao obter status da reprodução:', error);
    
    res.status(500).json({
      success: false,
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

    // 3. Parar todas as reproduções ativas
    if (activePlaybackServices.size > 0) {
      console.log(`🎬 Parando ${activePlaybackServices.size} reproduções ativas...`);
      for (const [recordingId, playbackService] of activePlaybackServices) {
        try {
          playbackService.cleanup();
          console.log(`✅ Reprodução ${recordingId} finalizada`);
        } catch (error) {
          console.error(`❌ Erro ao parar reprodução ${recordingId}:`, error);
        }
      }
      activePlaybackServices.clear();
      console.log('✅ Reproduções finalizadas');
    }

    // 4. Parar todas as gravações ativas
    if (activeRecordingServices.size > 0) {
      console.log(`🎬 Parando ${activeRecordingServices.size} gravações ativas...`);
      for (const [recordingId, recordingService] of activeRecordingServices) {
        try {
          await recordingService.stopCapture();
          console.log(`✅ Gravação ${recordingId} finalizada`);
        } catch (error) {
          console.error(`❌ Erro ao parar gravação ${recordingId}:`, error);
        }
      }
      activeRecordingServices.clear();
      activeRecordings.clear();
      console.log('✅ Gravações finalizadas');
    }

    // 5. Fechar todas as sessões ativas
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
  console.log(`\n🎬 Endpoints de Gravação:`);
  console.log(`   POST /api/recording/start - Iniciar gravação`);
  console.log(`   POST /api/recording/stop - Parar gravação`);
  console.log(`   POST /api/recording/pause - Pausar/resumir gravação`);
  console.log(`   GET  /api/recording/status/:sessionId - Status da gravação`);
  console.log(`\n📺 Endpoints de Preview:`);
  console.log(`   POST /api/recording/screenshot/:sessionId - Capturar screenshot da sessão`);
  console.log(`   GET  /api/recording/preview/:sessionId - Obter último screenshot`);
  console.log(`   GET  /api/recording/page-info/:sessionId - Informações da página`);
  console.log(`\n📤 Endpoints de Exportação:`);
  console.log(`   POST /api/recording/export - Exportar gravação (JSON/Puppeteer)`);
  console.log(`   GET  /api/recordings - Listar gravações disponíveis`);
  console.log(`   GET  /api/recording/:recordingId - Obter gravação específica`);
  console.log(`\n▶️ Endpoints de Reprodução:`);
  console.log(`   POST /api/recording/playback/start - Iniciar reprodução`);
  console.log(`   POST /api/recording/playback/control - Controlar reprodução`);
  console.log(`   POST /api/recording/playback/seek - Navegar na reprodução`);
  console.log(`   GET  /api/recording/playback/status/:recordingId - Status da reprodução`);

  console.log(`\n💡 Para usar o playground:`);
  console.log(`   1. Execute no terminal do host:`);
  console.log(`      google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug`);
  console.log(`   2. Acesse o playground em http://localhost:3000`);
  console.log(`\n🔧 Para parar o servidor: Ctrl+C (shutdown gracioso habilitado)`);
});
