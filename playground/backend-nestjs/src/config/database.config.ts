export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface DatabaseConnectionOptions {
  ssl?: boolean;
  connectionTimeout?: number;
  maxConnections?: number;
  idleTimeout?: number;
}

export interface DatabaseConfigWithOptions extends DatabaseConfig {
  options?: DatabaseConnectionOptions;
}