# Felinto Connect Bot

Uma biblioteca robusta para automação de navegadores usando Puppeteer com recursos avançados de tratamento de erros e retry automático.

## 🚀 Recursos

- ✅ **Tratamento robusto de erros** com classes de erro específicas
- 🔄 **Mecanismo de retry automático** com backoff exponencial
- 🌐 **Suporte a proxy** com autenticação
- 📸 **Sistema de screenshots** integrado
- 🔧 **Configuração flexível** para desenvolvimento e produção
- 🤖 **Plugin reCAPTCHA** integrado

## 📦 Instalação

```bash
npm install felinto-connect-bot
```

## 🛠️ Uso Básico

```typescript
import { newPage } from 'felinto-connect-bot';

// Uso simples
const page = await newPage({
  initialUrl: 'https://example.com',
  timeout: 30
});

// Com configurações de retry
const page = await newPage({
  initialUrl: 'https://example.com',
  retryOptions: {
    maxRetries: 5,
    baseDelay: 2000
  }
});
```

## 🎯 Parâmetros de Configuração

```typescript
interface newPageParams {
  browserWSEndpoint?: string;           // Endpoint do browser remoto
  userAgent?: string;                   // User agent customizado
  cookies?: Protocol.Network.CookieParam[]; // Cookies para definir
  timeout?: number;                     // Timeout em segundos (padrão: 60)
  initialUrl?: string;                  // URL inicial para navegar
  navigationOptions?: GoToOptions;      // Opções de navegação
  blockedResourcesTypes?: Set<string>;  // Tipos de recursos para bloquear
  slowMo?: number;                      // Delay entre ações (ms)
  $json?: any;                         // Configurações em formato JSON
  retryOptions?: {                     // Configurações de retry
    maxRetries?: number;               // Máximo de tentativas (padrão: 3)
    baseDelay?: number;                // Delay base em ms (padrão: 1000)
  };
}
```

## 🔄 Sistema de Retry

O sistema de retry utiliza **backoff exponencial** e é aplicado automaticamente para:

- Conexão com o browser
- Criação de páginas
- Navegação para URLs

```typescript
// Configuração personalizada de retry
const page = await newPage({
  initialUrl: 'https://site-instavel.com',
  retryOptions: {
    maxRetries: 5,        // Tentará 5 vezes
    baseDelay: 1500       // Delay inicial de 1.5s (1.5s, 3s, 6s, 12s, 24s)
  }
});
```

## ⚠️ Tratamento de Erros

A biblioteca inclui classes de erro específicas para diferentes cenários:

### Classes de Erro Disponíveis

```typescript
import { 
  BrowserConnectionError,
  PageCreationError, 
  NavigationError,
  AuthenticationError 
} from 'felinto-connect-bot';

try {
  const page = await newPage({ initialUrl: 'https://example.com' });
} catch (error) {
  if (error instanceof BrowserConnectionError) {
    console.log('Falha na conexão com o browser:', error.message);
  } else if (error instanceof NavigationError) {
    console.log('Falha na navegação:', error.message);
  } else if (error instanceof PageCreationError) {
    console.log('Falha ao criar página:', error.message);
  } else if (error instanceof AuthenticationError) {
    console.log('Falha na autenticação:', error.message);
  }
}
```

### Tipos de Erros Específicos

- **BrowserConnectionError**: Falhas de conexão/lançamento do browser
- **PageCreationError**: Falhas na criação ou configuração de páginas
- **NavigationError**: Falhas de navegação (DNS, timeout, conexão recusada)
- **AuthenticationError**: Falhas de autenticação com proxy

## 🌍 Variáveis de Ambiente

```bash
# Obrigatórias
TWO_CAPTCHA_KEY=sua_chave_2captcha

# Opcionais - Browser
CHROME_HEADLESS_WS_URL=ws://localhost:9222
CHROME_HEADLESS_ARGS=--no-sandbox,--disable-dev-shm-usage
DEFAULT_CHROME_HEADLESS_WIDTH_SCREEN=1920
DEFAULT_CHROME_HEADLESS_HEIGHT_SCREEN=1080

# Opcionais - Proxy
PROXY_USERNAME=seu_usuario
PROXY_PASSWORD=sua_senha

# Ambiente
NODE_ENV=production|development
```

## 📸 Screenshots

```typescript
const page = await newPage({ initialUrl: 'https://example.com' });

// Tira screenshot e armazena automaticamente
await page.takeScreenshot();

// Acessa todos os screenshots tirados
import { screenshots } from 'felinto-connect-bot';
console.log(`Total de screenshots: ${screenshots.length}`);
```

## 🔧 Exemplos Avançados

### Configuração Completa

```typescript
const page = await newPage({
  browserWSEndpoint: 'ws://chrome-server:9222',
  userAgent: 'Mozilla/5.0 (custom)',
  cookies: [
    { name: 'session', value: 'abc123', domain: '.example.com' }
  ],
  timeout: 45,
  initialUrl: 'https://example.com/login',
  navigationOptions: {
    waitUntil: 'networkidle0',
    timeout: 30000
  },
  slowMo: 500,
  retryOptions: {
    maxRetries: 3,
    baseDelay: 2000
  }
});
```

### Usando JSON para Configuração

```typescript
const config = {
  browserWSEndpoint: 'ws://localhost:9222',
  productPageUrl: 'https://example.com',
  browserUserAgent: 'Custom Bot 1.0',
  cookies: [/* seus cookies */]
};

const page = await newPage({ $json: config });
```

## 🏗️ Ambiente de Desenvolvimento vs Produção

### Desenvolvimento
- Browser é lançado localmente com interface gráfica
- `page.close()` é simulado (não fecha realmente)
- Logs mais verbosos

### Produção
- Conecta a browser remoto via WebSocket
- Requer `CHROME_HEADLESS_WS_URL` ou `browserWSEndpoint`
- Cleanup automático de recursos

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes. 