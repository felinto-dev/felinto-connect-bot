# Backend NestJS - Felinto Connect Bot

## 🎯 Visão Geral

Backend NestJS rodando em paralelo ao Express durante a migração incremental.

## 🚀 Comandos

### Desenvolvimento
```bash
pnpm dev          # Inicia servidor com hot-reload na porta 3002
pnpm start:debug  # Inicia com debugger
```

### Build e Produção
```bash
pnpm build        # Compila TypeScript para dist/
pnpm start        # Inicia servidor compilado
```

## 📊 Endpoints Disponíveis

### Health Check
- **GET** `/api/health` - Verifica status da aplicação

## 🔧 Configuração

### Variáveis de Ambiente

Crie arquivo `.env` na raiz do projeto com:

```env
PORT_NESTJS=3002
NODE_ENV=development
TWO_CAPTCHA_KEY=sua_chave_aqui
DEFAULT_CHROME_HEADLESS_WIDTH_SCREEN=1920
DEFAULT_CHROME_HEADLESS_HEIGHT_SCREEN=1080
CHROME_HEADLESS_WS_URL=ws://chromium:3000
CHROME_HEADLESS_ARGS=--no-sandbox,--disable-setuid-sandbox
```

## 🏗️ Estrutura

```
src/
├── main.ts              # Bootstrap da aplicação
├── app.module.ts        # Módulo raiz
├── config/              # Configurações
│   ├── configuration.ts
│   └── app.config.ts
├── common/              # Utilitários compartilhados
│   ├── interceptors/
│   └── filters/
└── health/              # Módulo de health check
    ├── health.controller.ts
    └── health.module.ts
```

## 📝 Próximas Fases

- [ ] WebSocket Gateway
- [ ] SessionModule
- [ ] RecordingModule
- [ ] ExportService
- [ ] PlaybackService
- [ ] Validação com DTOs
- [ ] Documentação Swagger