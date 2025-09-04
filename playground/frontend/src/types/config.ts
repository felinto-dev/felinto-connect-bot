// Define a estrutura de um cookie do Puppeteer
export interface PuppeteerCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

// Define a estrutura dos dados da sessão
export interface SessionData {
  cookies?: PuppeteerCookie[];
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
}

// Opções de navegação do Puppeteer
export interface NavigationOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

// Configuração principal da aplicação
export interface AppConfig {
  slowMo?: number;
  timeout?: number;
  userAgent?: string;
  browserWSEndpoint?: string;
  initialUrl?: string;
  sessionData?: SessionData;
  automationCode?: string;
  footerCode?: string;
  blockedResourcesTypes?: string[];
  navigationOptions?: NavigationOptions;
  constants?: Record<string, string>;
}
