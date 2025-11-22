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
  extra?: Record<string, unknown>;

  /**
   * Converte o DTO para SessionConfig, preservando campos adicionais
   */
  toSessionConfig(): SessionConfig {
    const config: SessionConfig = {
      browserWSEndpoint: this.browserWSEndpoint,
    };

    // Adicionar campo $debug se presente
    if (this.$debug !== undefined) {
      config.$debug = this.$debug;
    }

    // Adicionar campos extras ao config usando index signature
    if (this.extra) {
      Object.assign(config, this.extra);
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