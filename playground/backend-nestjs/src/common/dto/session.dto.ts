import { IsString, IsBoolean, IsOptional, IsNotEmpty, IsNumber, IsMin, IsMax, IsEnum } from 'class-validator';
import { SessionConfig } from '../types/session.types';

/**
 * DTO for creating sessions
 */
export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  browserWSEndpoint: string;

  @IsOptional()
  @IsBoolean()
  $debug?: boolean;

  /**
   * Converte o DTO para SessionConfig
   */
  toSessionConfig(): SessionConfig {
    const config: SessionConfig = {
      browserWSEndpoint: this.browserWSEndpoint,
    };

    if (this.$debug !== undefined) {
      config.$debug = this.$debug;
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

/**
 * DTO for screenshot options
 */
export class ScreenshotOptionsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  quality?: number;

  @IsOptional()
  @IsBoolean()
  fullPage?: boolean;

  @IsOptional()
  @IsEnum(['jpeg', 'png'])
  type?: 'jpeg' | 'png';
}