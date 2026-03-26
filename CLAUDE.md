# CLAUDE.md

Este arquivo fornece orientações ao Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Visão Geral do Projeto

`@felinto-dev/felinto-connect-bot` é uma biblioteca de automação de navegador baseada em Puppeteer para gerenciamento de sessão e extração de dados. Publicada como pacote npm. O código é um **monorepo pnpm**.

## Estrutura do Monorepo

| Workspace | Caminho | Descrição |
|-----------|---------|-----------|
| `lib` | `lib/` | Pacote npm principal (biblioteca de automação Puppeteer) |
| `playground/backend` | `playground/backend/` | Backend de debug Express.js (porta 3001, ESM) |
| `playground/backend-nestjs` | `playground/backend-nestjs/` | Backend NestJS (porta 3002, CJS) |
| `playground/frontend` | `playground/frontend/` | Frontend Vite + TypeScript vanilla (porta 3000) |

## Comandos

```bash
# Biblioteca
pnpm build          # Compila a biblioteca (tsup → lib/dist/)
pnpm test           # Executa testes Jest (lib/)
pnpm lint           # Verificação de tipos TypeScript (tsc --noEmit)
pnpm dev            # Modo watch (NÃO execute — apenas o desenvolvedor pode)

# Playground
pnpm playground:install     # Instala dependências do playground
pnpm playground:backend     # Dev backend Express
pnpm playground:backend-nestjs  # Dev backend NestJS
pnpm playground:frontend    # Dev frontend

# Outros
pnpm setup          # Instala todas as dependências (root + playground)
pnpm clean          # Remove todos os dist/ e node_modules
pnpm release        # Build + publicação via changeset
```

## Arquitetura

### Biblioteca Principal (`lib/`)

A biblioteca conecta a uma **instância Chrome remota via WebSocket** — não lança navegadores por conta própria. Usa `puppeteer-extra` com plugins de reCAPTCHA e sessão.

Módulos principais:
- `lib/utils/browser-factory.ts` — Classe `BrowserFactory`: conecta ao Chrome remoto via WebSocket
- `lib/utils/page-configurator.ts` — Classe `PageConfigurator`: proxy, user agent, headers, cookies, bloqueio de recursos
- `lib/utils/session-data-applier.ts` — Aplica dados de sessão (cookies, localStorage) às páginas
- `lib/session/SessionManager.ts` — Classe estática para persistência de sessão em `/tmp/puppeteer-sessions/`
- `lib/session/SessionPageExtender.ts` — Estende páginas Puppeteer com métodos de sessão (save/restore/clear)
- `lib/utils/retry-mechanism.ts` — `retryOperation()` com exponential backoff
- `lib/utils/custom-errors.ts` — Classes de erro customizadas: `BrowserConnectionError`, `PageCreationError`, `NavigationError`, `AuthenticationError`
- `lib/utils/cookies-converter.ts` — Conversão de formato de cookies (header Set-Cookie ↔ Puppeteer)

Ponto de entrada: `lib/index.ts` exporta a função `newPage()`. Tipos em `lib/types.ts`.

### Backend NestJS (`playground/backend-nestjs/`)

- Módulos: Config, Health, Websocket, Session, Recording, Playback, Utils
- Documentação Swagger em `/api/swagger`
- Validação: class-validator + class-transformer
- Configuração: validação com Joi via `@nestjs/config`

### Frontend (`playground/frontend/`)

- TypeScript vanilla com Vite (sem framework UI)
- Multi-page: `index.html` (playground), `recording.html` (UI de gravação)
- CodeMirror para edição de código
- Proxy de `/api` para `localhost:3001`

## Convenções Importantes

- **Sempre use pnpm.** Nunca npm ou yarn.
- **Nunca execute `pnpm dev`.** Apenas o desenvolvedor pode executar. Sugira e aguarde.
- **Sempre execute `pnpm build`** após alterações no código para verificar compilação (especialmente no NestJS).
- **Remova console.log** após depuração. Use apenas temporariamente para debug.
- **Formatos de módulo:** A biblioteca gera CJS + ESM via tsup. Backend Express usa ESM. Backend NestJS usa CJS.
- **Sem banco de dados** — todo estado é em memória ou baseado em arquivos (`/tmp/`).
- **Versionamento:** Usa Changesets (`@changesets/cli`).

## Variáveis de Ambiente

Veja `.env.example`. Variáveis principais:
- `TWO_CAPTCHA_KEY` — Obrigatória, chave da API 2Captcha
- `CHROME_HEADLESS_WS_URL` — Endpoint WebSocket do Chrome (padrão: `ws://chromium:3000`)
- `PORT_NESTJS` — Porta do backend NestJS (padrão: 3002)

## Testes

Jest + ts-jest. Os testes requerem uma instância Chrome em execução com remote debugging. Execute a partir da raiz: `pnpm test`.

Para executar um teste específico: `pnpm test -- --testNamePattern="nome do teste"` ou `pnpm test -- caminho/do/arquivo.test.ts`

## DevContainer

Node.js 20 (Bullseye). Post-create instala dependências pnpm + Claude Code CLI. Portas: 3000, 3001, 9222.
