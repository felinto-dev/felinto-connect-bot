import type { Page } from 'puppeteer';

// Tipagem para a função de broadcast do WebSocket
export type BroadcastFn = (message: BroadcastMessage) => void;

// Interface para as mensagens enviadas via WebSocket
export interface BroadcastMessage {
  type: 'info' | 'success' | 'warning' | 'error' | 'log' | 'session_expired';
  message: string;
  data?: unknown;
  sessionId?: string;
}

// Configuração para criar uma nova sessão do Puppeteer
export interface SessionConfig {
  browserWSEndpoint: string;
  $debug?: boolean;
  [key: string]: unknown; // Permite outras propriedades
}

// Estrutura de dados para uma sessão ativa
export interface SessionData {
  id: string;
  page: Page;
  config: SessionConfig;
  createdAt: Date;
  lastUsed: Date;
  executionCount: number;
}

// Informações sobre a página Puppeteer
export interface PageInfo {
  url: string;
  title: string;
  timestamp: string;
  error?: string;
}

// Resultado da execução de um código na sessão
export interface ExecutionResult {
  result: unknown;
  pageInfo: PageInfo;
}

// Estatísticas das sessões ativas
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalExecutions: number;
  oldestSession: number | null;
}
