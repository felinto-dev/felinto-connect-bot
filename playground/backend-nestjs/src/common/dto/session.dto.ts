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
  @ApiProperty({
    description: 'WebSocket endpoint do navegador para conectar',
    example: 'ws://localhost:3000/devtools/browser/...'
  })
  @IsString()
  @IsNotEmpty()
  browserWSEndpoint: string;

  @ApiPropertyOptional({
    description: 'Ativa modo debug para logs detalhados',
    example: false
  })
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
  @ApiProperty({
    description: 'ID da sessão para executar o código',
    example: 'session-12345'
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    description: 'Código JavaScript para executar na página',
    example: 'document.title'
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class SessionIdDto {
  @ApiProperty({
    description: 'ID da sessão',
    example: 'session-12345'
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

/**
 * DTO for taking screenshot
 */
export class TakeScreenshotDto {
  @ApiProperty({
    description: 'ID da sessão para capturar screenshot',
    example: 'session-12345'
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiPropertyOptional({
    description: 'Opções para captura de screenshot',
    type: () => ScreenshotOptionsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScreenshotOptionsDto)
  options?: ScreenshotOptionsDto;
}

/**
 * DTO for screenshot options
 */
export class ScreenshotOptionsDto {
  @ApiPropertyOptional({
    description: 'Qualidade da imagem (0-100, apenas para JPEG)',
    minimum: 0,
    maximum: 100,
    example: 80
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  quality?: number;

  @ApiPropertyOptional({
    description: 'Captura a página completa',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  fullPage?: boolean;

  @ApiPropertyOptional({
    description: 'Formato da imagem',
    enum: ScreenshotType,
    example: ScreenshotType.PNG
  })
  @IsOptional()
  @IsEnum(ScreenshotType)
  type?: ScreenshotType;

  @ApiPropertyOptional({
    description: 'Área de recorte para captura parcial',
    example: { x: 0, y: 0, width: 800, height: 600 }
  })
  @IsOptional()
  clip?: any;

  @ApiPropertyOptional({
    description: 'Remove o background da página (útil para transparência)',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  omitBackground?: boolean;
}