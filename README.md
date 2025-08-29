# Felinto Connect Bot

Uma biblioteca robusta para automação de navegadores usando Puppeteer com recursos avançados de tratamento de erros e retry automático.

## 🚀 Recursos

- ✅ **Tratamento robusto de erros** com classes de erro específicas
- 🔄 **Mecanismo de retry automático** com backoff exponencial
- 🌐 **Suporte a proxy** com autenticação
- 📸 **Sistema de screenshots** integrado
- 🔧 **Configuração flexível** para desenvolvimento e produção
- 🤖 **Plugin reCAPTCHA** integrado
- 💾 **Gerenciamento de sessões** com persistência automática

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
  userDataDir?: string;                // Diretório para persistência de sessão
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
  AuthenticationError,
  SessionManager,
  SessionEnabledPage
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

## 💾 Gerenciamento de Sessões

A biblioteca oferece um sistema robusto de persistência de sessões que permite manter dados como cookies, localStorage, sessionStorage e outros estados da página entre execuções.

### Como Funciona

O sistema de sessões funciona automaticamente quando você especifica um `userDataDir`:

- **Salvamento Automático**: As sessões são salvas automaticamente quando a página é fechada
- **Restauração Automática**: Sessões são restauradas automaticamente ao navegar para páginas
- **Persistência**: Dados ficam armazenados em `/tmp/puppeteer-sessions/` com nomes seguros

### Uso Básico com Sessões

```typescript
import { newPage } from 'felinto-connect-bot';

// Criar nova página com sessão
const page = await newPage({
  initialUrl: 'https://example.com/login',
  userDataDir: 'minha-sessao-login'
});

// Fazer login (cookies e dados de sessão serão salvos automaticamente)
await page.type('#username', 'meu-usuario');
await page.type('#password', 'minha-senha');
await page.click('#login-btn');

// Fechar página (sessão salva automaticamente)
await page.close();

// Reutilizar sessão em nova página
const paginaComSessao = await newPage({
  initialUrl: 'https://example.com/dashboard',
  userDataDir: 'minha-sessao-login' // Mesma sessão
});
// Já estará logado!
```

### Métodos de Sessão Disponíveis

Quando você usa `userDataDir`, a página ganha métodos extras:

```typescript
const page = await newPage({ 
  userDataDir: 'minha-sessao',
  initialUrl: 'https://example.com'
});

// Salvar sessão manualmente
const salvou = await page.saveSession();
console.log('Sessão salva:', salvou);

// Restaurar sessão manualmente
const restaurou = await page.restoreSession();
console.log('Sessão restaurada:', restaurou);

// Limpar sessão armazenada
const limpou = await page.clearSession();
console.log('Sessão limpa:', limpou);
```

### Funcionalidade `newPage()`

- **`newPage()`**: Cria uma nova página. Se `userDataDir` for fornecido, habilita funcionalidades de sessão e restaura automaticamente dados salvos quando disponíveis.

```typescript
// Primeira execução - cria nova sessão
const pagina1 = await newPage({
  userDataDir: 'sessao-ecommerce',
  initialUrl: 'https://loja.com/login'
});

// Login e navegação...
await pagina1.close(); // Sessão salva automaticamente

// Segunda execução - reutiliza sessão automaticamente
const pagina2 = await newPage({
  userDataDir: 'sessao-ecommerce', // Mesma sessão
  initialUrl: 'https://loja.com/carrinho'
});
// Já está logado e com itens no carrinho preservados!
```

### Casos de Uso Reais

**E-commerce com Carrinho Persistente:**
```typescript
const loja = await newPage({
  userDataDir: 'carrinho-compras',
  initialUrl: 'https://loja.com'
});

// Adicionar produtos ao carrinho
await loja.click('.produto-1 .adicionar-carrinho');
await loja.close();

// Retomar compra mais tarde
const checkout = await newPage({
  userDataDir: 'carrinho-compras',
  initialUrl: 'https://loja.com/checkout'
});
// Carrinho mantido!
```

**Automação com Login Persistente:**
```typescript
// Login uma vez
const login = await newPage({
  userDataDir: 'bot-admin',
  initialUrl: 'https://admin.site.com/login'
});
// Fazer login...
await login.close();

// Executar tarefas diárias sem novo login
const tarefa1 = await newPage({
  userDataDir: 'bot-admin',
  initialUrl: 'https://admin.site.com/relatorios'
});

const tarefa2 = await newPage({
  userDataDir: 'bot-admin', 
  initialUrl: 'https://admin.site.com/usuarios'
});
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
  userDataDir: 'minha-sessao-personalizada', // Sessão persistente
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
  userDataDir: 'sessao-bot-personalizado',
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