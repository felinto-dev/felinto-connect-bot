import { IsString, IsBoolean, IsOptional, IsNotEmpty, IsNumber, Min, Max, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SessionConfig } from '../types/session.types';

/**
 * Screenshot format types
 */
export enum ScreenshotType {
  JPEG = 'jpeg',
  PNG = 'png'
}

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
 * DTO for taking screenshot
 */
export class TakeScreenshotDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScreenshotOptionsDto)
  options?: ScreenshotOptionsDto;
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
  @IsEnum(ScreenshotType)
  type?: ScreenshotType;

  @IsOptional()
  clip?: any;

  @IsOptional()
  @IsBoolean()
  omitBackground?: boolean;
}