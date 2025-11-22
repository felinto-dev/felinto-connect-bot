import type { Page } from 'puppeteer';

export interface SessionConfig {
  browserWSEndpoint: string;
  $debug?: boolean;
  [key: string]: unknown;
}

export interface SessionData {
  id: string;
  page: Page;
  config: SessionConfig;
  createdAt: Date;
  lastUsed: Date;
  executionCount: number;
}

export interface PageInfo {
  url: string;
  title: string;
  timestamp: string;
  error?: string;
}

export interface ExecutionResult {
  result: unknown;
  pageInfo: PageInfo;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalExecutions: number;
  oldestSession: number | null;
}