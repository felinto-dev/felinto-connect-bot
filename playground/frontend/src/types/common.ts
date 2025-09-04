// Tipos de logs para a saída do console
export type LogType = 'info' | 'success' | 'warning' | 'error';

// Estrutura de uma entrada de log
export interface LogEntry {
  message: string;
  type: LogType;
  timestamp: string;
}
