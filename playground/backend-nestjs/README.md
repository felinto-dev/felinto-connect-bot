# Backend NestJS - Felinto Connect Bot

Backend completo para automação web com Puppeteer, gravação de eventos e reprodução

![NestJS](https://img.shields.io/badge/nestjs-10.0-red) ![TypeScript](https://img.shields.io/badge/typescript-5.9-blue) ![Puppeteer](https://img.shields.io/badge/puppeteer-latest-green)

## 🎯 Visão Geral

Backend NestJS migrado do Express com funcionalidades completas de gerenciamento de sessões Puppeteer, gravação de interações do usuário, reprodução com controle de velocidade, e exportação em múltiplos formatos.

### Características Principais

- 🤖 **Gerenciamento de Sessões Puppeteer** - Crie, controle e gerencie múltiplas sessões de navegador
- 📹 **Gravação de Eventos** - Capture clicks, digitação, navegação e formulários automaticamente
- ▶️ **Reprodução com Controle** - Execute gravações com controle de velocidade, pausa e seek
- 📤 **Exportação Multi-formato** - Exporte gravações como JSON ou scripts Puppeteer
- 🔌 **WebSocket Real-time** - Notificações ao vivo de eventos e status
- ✅ **Validação Automática** - DTOs com class-validator para todas as requisições
- 📚 **Documentação Swagger** - API interativa completa em `/api/docs`
- 🔄 **Graceful Shutdown** - Desligamento seguro com cleanup de recursos
- 🐳 **Suporte Docker** - Detecção automática de Chrome em ambientes containerizados

## 📋 Índice

- [Instalação e Configuração](#-instalação-e-configuração)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Comandos Disponíveis](#-comandos-disponíveis)
- [Endpoints da API](#-endpoints-da-api)
- [Documentação Interativa](#-documentação-interativa)
- [WebSocket](#-websocket)
- [Exemplos de Uso](#-exemplos-de-uso)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Troubleshooting](#-troubleshooting)
- [Migração do Express](#-migração-do-express)
- [Próximas Fases](#-próximas-fases)

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js 18+
- pnpm 10+
- Chrome/Chromium com remote debugging

### Instalação

```bash
# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações

# Iniciar desenvolvimento
pnpm dev
```

### Configuração de Variáveis de Ambiente

Crie arquivo `.env` na raiz `/workspaces/felinto-connect-bot/playground/backend-nestjs/`:

## 🔧 Variáveis de Ambiente

| Variável | Descrição | Padrão | Obrigatório |
|----------|-----------|--------|-------------|
| `PORT_NESTJS` | Porta do servidor NestJS | `3002` | Não |
| `NODE_ENV` | Ambiente de execução | `development` | Não |
| `TWO_CAPTCHA_KEY` | Chave API do 2Captcha para resolução de captchas | - | Sim (se usar captchas) |
| `DEFAULT_CHROME_HEADLESS_WIDTH_SCREEN` | Largura padrão do viewport | `1920` | Não |
| `DEFAULT_CHROME_HEADLESS_HEIGHT_SCREEN` | Altura padrão do viewport | `1080` | Não |
| `CHROME_HEADLESS_WS_URL` | WebSocket URL do Chrome remoto | `ws://chromium:3000` | Sim |
| `CHROME_HEADLESS_ARGS` | Argumentos do Chrome (separados por vírgula) | `--no-sandbox,--disable-setuid-sandbox` | Não |

## 🏃 Comandos Disponíveis

```bash
# Desenvolvimento
pnpm dev              # Desenvolvimento com hot-reload (tsx watch)
pnpm start:dev        # Desenvolvimento com NestJS CLI watch
pnpm start:debug      # Modo debug com breakpoints

# Produção
pnpm build            # Compila TypeScript para `dist/`
pnpm start            # Produção (requer build prévio)
```

## 📊 Endpoints da API

### Health Check

| Método | Endpoint | Descrição |
|--------|----------|----------|
| GET | `/api/health` | Verifica status da aplicação |

### Session Management

| Método | Endpoint | Descrição |
|--------|----------|----------|
| POST | `/api/session/create` | Cria nova sessão Puppeteer |
| POST | `/api/session/execute` | Executa código JavaScript na sessão |
| POST | `/api/session/screenshot` | Captura screenshot da sessão |
| DELETE | `/api/session/:sessionId` | Remove sessão ativa |
| GET | `/api/session/s/stats` | Obtém estatísticas de sessões |
| GET | `/api/session/:sessionId/validate` | Valida se sessão está ativa |

### Recording

| Método | Endpoint | Descrição |
|--------|----------|----------|
| POST | `/api/recording/start` | Inicia gravação de eventos |
| POST | `/api/recording/stop` | Para gravação ativa |
| POST | `/api/recording/pause` | Pausa/retoma gravação |
| GET | `/api/recording/status/:sessionId` | Obtém status da gravação |
| POST | `/api/recording/screenshot/:sessionId` | Captura screenshot com metadados |
| GET | `/api/recording/preview/:sessionId` | Preview rápido (quality=60) |
| GET | `/api/recording/page-info/:sessionId` | Informações da página atual |

### Export

| Método | Endpoint | Descrição |
|--------|----------|----------|
| POST | `/api/recording/export` | Exporta gravação (JSON/Puppeteer) |
| GET | `/api/recordings` | Lista todas as gravações |
| GET | `/api/recording/:recordingId` | Obtém gravação completa |

### Playback

| Método | Endpoint | Descrição |
|--------|----------|----------|
| POST | `/api/recording/playback/start` | Inicia reprodução |
| POST | `/api/recording/playback/control` | Controla reprodução (pause/resume/stop) |
| POST | `/api/recording/playback/seek` | Pula para evento específico |
| GET | `/api/recording/playback/status/:recordingId` | Status da reprodução |

### Utils

| Método | Endpoint | Descrição |
|--------|----------|----------|
| POST | `/api/execute` | [LEGACY] Cria sessão sem sessionId |
| GET | `/api/chrome/check` | Detecta Chrome remoto |
| GET | `/api/docs` | Documentação README como HTML |

## 📚 Documentação Interativa

Swagger UI disponível em: `http://localhost:3002/api/docs`

Interface interativa para testar todos os endpoints, visualizar schemas, e explorar exemplos de request/response.

## 🔌 WebSocket

**Endpoint**: `ws://localhost:3002/ws`

**Tipos de mensagens**:
- `success` - Operações bem-sucedidas
- `error` - Erros e falhas
- `info` - Informações gerais
- `warning` - Avisos
- `screenshot_capture` - Capturas de tela
- `session_expired` - Sessões expiradas

**Exemplo de conexão JavaScript**:
```javascript
const ws = new WebSocket('ws://localhost:3002/ws');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message.type, message.message);
};
```

## 💡 Exemplos de Uso

### Criar Sessão e Navegar

```bash
# Criar sessão
curl -X POST http://localhost:3002/api/session/create \
  -H "Content-Type: application/json" \
  -d '{"browserWSEndpoint":"ws://localhost:9222","$debug":true}'

# Executar código
curl -X POST http://localhost:3002/api/session/execute \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"abc123","code":"await page.goto('\"'https://example.com'\"');"}'
```

### Gravar e Exportar

```bash
# Iniciar gravação
curl -X POST http://localhost:3002/api/recording/start \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"abc123","events":["click","type","navigation"],"mode":"manual","delay":100,"captureScreenshots":true}'

# Parar gravação
curl -X POST http://localhost:3002/api/recording/stop \
  -H "Content-Type: application/json" \
  -d '{"recordingId":"rec-abc123"}'

# Exportar como Puppeteer
curl -X POST http://localhost:3002/api/recording/export \
  -H "Content-Type: application/json" \
  -d '{"recordingId":"rec-abc123","options":{"format":"puppeteer","includeScreenshots":false,"minifyOutput":false,"addComments":true}}'
```

### Reproduzir Gravação

```bash
# Iniciar playback
curl -X POST http://localhost:3002/api/recording/playback/start \
  -H "Content-Type: application/json" \
  -d '{"recordingId":"rec-abc123","sessionId":"abc123","speed":1.5,"pauseOnError":true,"skipScreenshots":false}'

# Pausar
curl -X POST http://localhost:3002/api/recording/playback/control \
  -H "Content-Type: application/json" \
  -d '{"recordingId":"rec-abc123","action":"pause"}'
```

## 🏗️ Estrutura do Projeto

```
src/
├── main.ts                    # Bootstrap e configuração Swagger
├── app.module.ts              # Módulo raiz
├── common/                    # Compartilhado
│   ├── dto/                   # DTOs com validação
│   │   ├── session.dto.ts
│   │   ├── recording.dto.ts
│   │   ├── playback.dto.ts
│   │   └── export.dto.ts
│   ├── types/                 # Interfaces TypeScript
│   │   ├── session.types.ts
│   │   ├── recording.types.ts
│   │   ├── playback.types.ts
│   │   ├── export.types.ts
│   │   ├── websocket.types.ts
│   │   └── api-responses.types.ts
│   ├── filters/               # Exception filters
│   └── interceptors/          # Logging interceptors
├── config/                    # Configurações
├── health/                    # Health check
├── session/                   # Gerenciamento de sessões
│   ├── session.service.ts
│   ├── session.controller.ts
│   └── session.module.ts
├── recording/                 # Gravação de eventos
│   ├── recording.service.ts
│   ├── recording-capture.service.ts
│   ├── export.service.ts
│   ├── recording.controller.ts
│   └── recording.module.ts
├── playback/                  # Reprodução
│   ├── playback.service.ts
│   ├── playback-capture.service.ts
│   ├── playback.controller.ts
│   └── playback.module.ts
├── utils/                     # Utilitários
│   ├── chrome-detector.service.ts
│   ├── documentation.service.ts
│   ├── utils.controller.ts
│   └── utils.module.ts
└── websocket/                 # WebSocket Gateway
    ├── websocket.gateway.ts
    └── websocket.module.ts
```

## 🐛 Troubleshooting

### Chrome não detectado

**Problema**: `GET /api/chrome/check` retorna `available: false`

**Solução macOS**:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --remote-debugging-address=0.0.0.0 \
  --disable-web-security \
  --disable-features=VizDisplayCompositor
```

**Solução Linux**:
```bash
google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --disable-web-security
```

**Verificação**:
- Firewall desativado ou regras permitindo porta 9222
- Permissões de rede local (macOS: Ajustes > Privacidade > Rede Local)
- porta 9222 disponível e não em uso

### Sessão expira rapidamente

**Problema**: `sessionExpired: true` em requests

**Causa**: Timeout de inatividade (10 minutos padrão)

**Solução**: Fazer requests periódicos (ex: `GET /api/session/:id/validate`) ou ajustar timeout em `SessionService`

### Gravação não captura eventos

**Problema**: `totalEvents: 0` após gravação

**Verificação**:
- `events` array no `StartRecordingDto` contém tipos válidos (`click`, `type`, `navigation`, `form`, `key_press`)
- Sessão está ativa e página carregada
- Modo `manual` requer interação do usuário; modo `auto` captura automaticamente

### Playback falha em eventos

**Problema**: Reprodução para com erro

**Solução**:
- Usar `pauseOnError: true` para debug
- Verificar logs de erro no WebSocket
- Causa comum: Seletores CSS mudaram, elementos não encontrados, timeouts

### Erro de validação em DTOs

**Problema**: `400 Bad Request` com mensagens de validação

**Solução**:
- Verificar tipos de dados (ex: `speed` deve ser number, não string)
- Campos obrigatórios presentes
- Ranges validados (ex: `quality` 0-100)
- Usar Swagger UI para ver schemas exatos

## 🔄 Migração do Express

**Status**: ✅ **Migração 100% completa**

Todas as funcionalidades do backend Express foram portadas para NestJS com as seguintes melhorias adicionadas:

- ✅ Swagger docs com UI interativa
- ✅ Validação automática com DTOs
- ✅ Arquitetura modular e organizada
- ✅ Graceful shutdown robusto
- ✅ TypeScript strict mode

**Compatibilidade**: Endpoints mantêm mesmos paths, request/response shapes, e comportamentos para garantir transição transparente.

## 📝 Próximas Fases

- [x] WebSocket Gateway
- [x] SessionModule
- [x] RecordingModule
- [x] ExportService
- [x] PlaybackService
- [x] Validação com DTOs
- [x] Documentação Swagger
- [ ] Testes unitários (Jest)
- [ ] Testes E2E
- [ ] CI/CD pipeline
- [ ] Monitoramento e métricas (Prometheus)
- [ ] Rate limiting
- [ ] Autenticação/Autorização

## 🔗 Links Úteis

- [Documentação Puppeteer](https://pptr.dev/)
- [NestJS Docs](https://docs.nestjs.com/)
- [Swagger/OpenAPI](https://swagger.io/)

## 📄 Licença e Contribuição

Licença MIT. Contribuições são bem-vindas!