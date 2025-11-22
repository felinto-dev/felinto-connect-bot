import { IsString, IsBoolean, IsOptional, IsNotEmpty, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { SessionConfig } from '../types/session.types';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  browserWSEndpoint: string;

  @IsOptional()
  @IsBoolean()
  $debug?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /**
   * Converte o DTO para SessionConfig, usando index signature diretamente
   */
  toSessionConfig(): SessionConfig {
    const config: SessionConfig = {
      browserWSEndpoint: this.browserWSEndpoint,
    };

    // Adicionar campo $debug se presente
    if (this.$debug !== undefined) {
      config.$debug = this.$debug;
    }

    // Adicionar campos de configuração adicionais usando index signature
    if (this.config) {
      Object.assign(config, this.config);
    }

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