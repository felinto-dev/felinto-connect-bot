import { IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';
import { SessionConfig } from '../types/session.types';

/**
 * DTO for creating sessions with backward compatibility to Express backend
 * Supports both direct properties and nested config object for migration
 */
export class CreateSessionDto implements SessionConfig {
  @IsString()
  @IsNotEmpty()
  browserWSEndpoint: string;

  @IsOptional()
  @IsBoolean()
  $debug?: boolean;

  // Index signature para permitir propriedades adicionais como no Express backend
  [key: string]: unknown;

  /**
   * Converte o DTO para SessionConfig preservando compatibilidade com Express backend
   * Mantém todas as propriedades adicionais diretamente no objeto de configuração
   */
  toSessionConfig(): SessionConfig {
    const config: SessionConfig = {
      browserWSEndpoint: this.browserWSEndpoint,
    };

    // Copiar todas as propriedades adicionais do DTO para o config
    Object.keys(this).forEach(key => {
      if (key !== 'browserWSEndpoint' && this[key] !== undefined) {
        (config as any)[key] = this[key];
      }
    });

    return config;
  }
}

export class ExecuteCodeDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}

export class SessionIdDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}