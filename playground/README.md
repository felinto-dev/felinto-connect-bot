# 🤖 Felinto Connect Bot - Debug Playground

Interface web para debug e desenvolvimento com o `felinto-connect-bot`.

## ⚠️ **IMPORTANTE - Configuração Chrome**

Para que o playground funcione corretamente, o Chrome **DEVE** ser iniciado com:
- `--remote-debugging-port=9222` → Habilita DevTools Protocol
- `--remote-debugging-address=0.0.0.0` → **ESSENCIAL** - permite conexões externas (do container)

## 🚀 Quick Start

### 1. Preparar o Chrome (Host)

#### 🍎 **macOS:**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --remote-debugging-address=0.0.0.0 \
  --user-data-dir=/tmp/chrome-debug \
  --disable-web-security \
  --disable-features=VizDisplayCompositor \
  --disable-site-isolation-trials \
  --allow-running-insecure-content \
  --ignore-ssl-errors \
  --ignore-certificate-errors \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding
```

#### 🐧 **Linux:**
```bash
google-chrome \
  --remote-debugging-port=9222 \
  --remote-debugging-address=0.0.0.0 \
  --disable-web-security
```

#### 🪟 **Windows:**
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --remote-debugging-address=0.0.0.0 ^
  --disable-web-security
```

### 2. Iniciar o Playground
No terminal do devcontainer:

```bash
cd playground
pnpm install:all
pnpm run dev
```

### 3. Acessar
O playground abre automaticamente em `http://localhost:3000`

## 📋 Funcionalidades

### ⚙️ Interface de Configuração
- **Templates prontos**: E-commerce, Social Media, Scraping
- **Configuração visual**: Todos os parâmetros do `newPage()`
- **Validação em tempo real**: JSON, URLs, configurações
- **Persistência**: Configurações salvas automaticamente

### 🚀 Execução
- **Detecção automática**: Verifica se Chrome está disponível
- **Logs em tempo real**: WebSocket para feedback imediato
- **Chrome visual**: Abre no seu desktop para debug
- **Geração de código**: Cria código TypeScript pronto para usar

### 🔧 Templates Incluídos

#### 🌐 Básico
```javascript
{
  slowMo: 1000,
  timeout: 60,
  initialUrl: 'https://example.com'
}
```

#### 🛒 E-commerce
```javascript
{
  slowMo: 500,
  timeout: 90,
  initialUrl: 'https://shopee.com.br',
  sessionData: {
    localStorage: {
      preferred_language: 'pt-BR',
      currency: 'BRL'
    }
  }
}
```

#### 📱 Social Media
```javascript
{
  slowMo: 800,
  timeout: 120,
  initialUrl: 'https://twitter.com/login',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
  sessionData: {
    cookies: [
      {"name": "logged_in", "value": "yes", "domain": ".twitter.com"}
    ]
  }
}
```

#### 🔍 Web Scraping
```javascript
{
  slowMo: 200,
  timeout: 45,
  blockedResourcesTypes: ['image', 'stylesheet', 'font'],
  navigationOptions: { waitUntil: 'networkidle0' }
}
```

## 🛠️ Arquitetura

### Frontend (Vite + Vanilla JS)
- **Interface moderna**: CSS Grid, Flexbox, animações
- **WebSocket**: Logs em tempo real
- **Local Storage**: Persistência de configurações
- **Validação**: JSON, URLs, campos obrigatórios

### Backend (Express + WebSocket)
- **API REST**: Endpoints para execução e geração de código
- **WebSocket**: Comunicação bidirecional
- **Integração**: Usa `felinto-connect-bot` diretamente
- **Detecção**: Verifica conexão com Chrome automaticamente

## 📁 Estrutura

```
playground/
├── frontend/           # Interface web (Vite)
│   ├── src/
│   │   ├── main.js    # Lógica principal
│   │   └── style.css  # Estilos modernos
│   └── index.html     # Interface HTML
├── backend/           # API server (Express)
│   └── server.js      # WebSocket + REST API
└── README.md          # Esta documentação
```

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento (frontend + backend)
pnpm run dev

# Instalar todas as dependências
pnpm install:all

# Apenas frontend
pnpm run frontend:dev

# Apenas backend
pnpm run backend:dev

# Build para produção
pnpm run build
```

## 📡 Endpoints da API

### GET `/api/health`
Health check do servidor

### GET `/api/chrome/check`
Verifica se Chrome está disponível na porta 9222

### POST `/api/execute`
Executa uma sessão com a configuração fornecida



## 🐛 Troubleshooting

### 🚨 **Chrome não conecta (macOS)**

#### **1. Verificação Manual:**
```bash
# Verificar se Chrome está na porta 9222
lsof -i :9222

# Testar API DevTools
curl http://localhost:9222/json/version
```

#### **2. Permissões macOS:**
1. **Rede Local:** Ajustes do Sistema → Privacidade e Segurança → Rede Local
2. **Firewall:** Ajustes do Sistema → Rede → Firewall
3. Certifique-se de que Chrome tem permissões

#### **3. Comando Correto (IMPORTANTE):**
⚠️ **A flag `--remote-debugging-address=0.0.0.0` é ESSENCIAL** para permitir conexões do container:
```bash
--remote-debugging-address=0.0.0.0  # ← SEM ISSO NÃO FUNCIONA!
```

#### **4. Alternativas de Endpoint:**
Se `host.docker.internal` não funciona, o playground testa automaticamente:
- `172.17.0.1:9222` (IP do gateway)
- `localhost:9222`
- `127.0.0.1:9222`
- `docker.for.mac.localhost:9222`

### 🐧 **Linux/Windows**
1. Verifique se o comando foi executado no **host**, não no container
2. Confirme que a porta 9222 não está em uso
3. Tente com `--disable-web-security` se necessário

### 📡 **WebSocket não conecta**
1. Verifique se o backend está rodando na porta 3001
2. Confirme que não há firewall bloqueando
3. Tente recarregar a página

### 🗃️ **Erro de permissões**
1. Confirme que `/tmp/chrome-debug` é acessível e tem permissões de escrita
2. Se houver problemas com `/tmp/chrome-debug`, tente outro diretório: `--user-data-dir=~/chrome-debug`
3. Em macOS, pode ser necessário dar permissão ao Terminal para acessar arquivos
4. Execute Chrome como administrador se necessário

## 💡 Dicas

- Use **Slow Motion** para ver as ações acontecendo
- **Templates** são um ótimo ponto de partida
- **Logs em tempo real** mostram exatamente o que está acontecendo
- **Código gerado** pode ser copiado direto para seus projetos
- **Configurações** são salvas automaticamente entre sessões
