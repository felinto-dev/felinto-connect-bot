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


export class StartRecordingDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(RecordingEventTypeEnum, { each: true })
  events: RecordingEventType[];

  @IsEnum(RecordingModeEnum)
  mode: RecordingMode;

  @IsNumber()
  @Min(0)
  delay: number;

  @IsBoolean()
  captureScreenshots: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  screenshotInterval?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  maxDuration?: number;

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
  @IsString()
  @IsNotEmpty()
  recordingId: string;
}

export class PauseRecordingDto {
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @IsBoolean()
  pause: boolean;
}

export class ScreenshotDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  quality?: number;

  @IsOptional()
  @IsBoolean()
  fullPage?: boolean;
}