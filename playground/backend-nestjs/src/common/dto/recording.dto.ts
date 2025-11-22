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
import { RecordingEventType, RecordingMode } from '../types/recording.types';

export class StartRecordingDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(RecordingEventType, { each: true })
  events: RecordingEventType[];

  @IsEnum(RecordingMode)
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
}

export class StopRecordingDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class PauseRecordingDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsBoolean()
  pause: boolean;
}

export class ScreenshotDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  quality?: number;
}