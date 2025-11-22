import { IsString, IsBoolean, IsOptional, IsNotEmpty, IsNumber, Min, Max, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SessionConfig } from '../types/session.types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiProperty({ description: 'WebSocket endpoint do Chrome/Chromium para conexão remota', example: 'ws://localhost:9222' })
  @IsString()
  @IsNotEmpty()
  browserWSEndpoint: string;

  @ApiPropertyOptional({ description: 'Habilita logs detalhados de debug no console', default: false })
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
  @ApiProperty({ description: 'ID da sessão ativa onde o código será executado', example: 'abc123-def456' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'Código JavaScript a ser executado no contexto da página Puppeteer', example: 'await page.goto("https://example.com")' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class SessionIdDto {
  @ApiProperty({ description: 'ID único da sessão', example: 'abc123-def456' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

/**
 * DTO for taking screenshot
 */
export class TakeScreenshotDto {
  @ApiProperty({ description: 'ID da sessão para captura de screenshot', example: 'abc123-def456' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiPropertyOptional({ description: 'Opções de configuração do screenshot', type: () => ScreenshotOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScreenshotOptionsDto)
  options?: ScreenshotOptionsDto;
}

/**
 * DTO for screenshot options
 */
export class ScreenshotOptionsDto {
  @ApiPropertyOptional({ description: 'Qualidade JPEG (0-100). Apenas para type=jpeg', minimum: 0, maximum: 100, example: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  quality?: number;

  @ApiPropertyOptional({ description: 'Captura página inteira com scroll', default: false })
  @IsOptional()
  @IsBoolean()
  fullPage?: boolean;

  @ApiPropertyOptional({ description: 'Formato da imagem', enum: ScreenshotType, default: ScreenshotType.PNG })
  @IsOptional()
  @IsEnum(ScreenshotType)
  type?: ScreenshotType;

  @ApiPropertyOptional({ description: 'Área específica para captura (x, y, width, height)', example: { x: 0, y: 0, width: 800, height: 600 } })
  @IsOptional()
  clip?: any;

  @ApiPropertyOptional({ description: 'Remove fundo branco padrão (apenas PNG)', default: false })
  @IsOptional()
  @IsBoolean()
  omitBackground?: boolean;
}