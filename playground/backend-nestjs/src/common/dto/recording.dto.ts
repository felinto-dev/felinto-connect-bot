import {
  IsString,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Min,
  Max,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecordingEventType, RecordingMode, RecordingEventTypeEnum, RecordingModeEnum, RecordingConfig } from '../types/recording.types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';


export class StartRecordingDto {
  @ApiProperty({ description: 'ID da sessão onde a gravação será iniciada', example: 'abc123-def456' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'Tipos de eventos a serem capturados', enum: RecordingEventTypeEnum, isArray: true, example: ['click', 'type', 'navigation'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(RecordingEventTypeEnum, { each: true })
  events: RecordingEventType[];

  @ApiProperty({ description: 'Modo de gravação (manual ou automático)', enum: RecordingModeEnum, example: 'manual' })
  @IsEnum(RecordingModeEnum)
  mode: RecordingMode;

  @ApiProperty({ description: 'Delay em ms entre eventos capturados', minimum: 0, example: 100 })
  @IsNumber()
  @Min(0)
  delay: number;

  @ApiProperty({ description: 'Habilita captura automática de screenshots durante gravação', example: true })
  @IsBoolean()
  captureScreenshots: boolean;

  @ApiPropertyOptional({ description: 'Intervalo em ms entre screenshots automáticos', minimum: 0, example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  screenshotInterval?: number;

  @ApiPropertyOptional({ description: 'Duração máxima da gravação em ms', minimum: 1000, example: 300000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  maxDuration?: number;

  @ApiPropertyOptional({ description: 'Número máximo de eventos a capturar', minimum: 1, example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxEvents?: number;

  /**
   * Converte o DTO para o tipo de domínio RecordingConfig
   * sessionId é gerenciado separadamente em RecordingData e nos DTOs de entrada
   */
  toRecordingConfig(): RecordingConfig {
    return {
      events: this.events,
      mode: this.mode,
      delay: this.delay,
      captureScreenshots: this.captureScreenshots,
      screenshotInterval: this.screenshotInterval,
      maxDuration: this.maxDuration,
      maxEvents: this.maxEvents,
    };
  }
}

export class StopRecordingDto {
  @ApiProperty({ description: 'ID da gravação a ser parada', example: 'rec-abc123' })
  @IsString()
  @IsNotEmpty()
  recordingId: string;
}

export class PauseRecordingDto {
  @ApiProperty({ description: 'ID da gravação a pausar/retomar', example: 'rec-abc123' })
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @ApiProperty({ description: 'true para pausar, false para retomar', example: true })
  @IsBoolean()
  pause: boolean;
}

export class ScreenshotDto {
  @ApiPropertyOptional({ description: 'Qualidade JPEG (0-100)', minimum: 0, maximum: 100, example: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  quality?: number;

  @ApiPropertyOptional({ description: 'Captura página inteira', default: false })
  @IsOptional()
  @IsBoolean()
  fullPage?: boolean;
}