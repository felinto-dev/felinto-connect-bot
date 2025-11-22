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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecordingEventType, RecordingMode, RecordingEventTypeEnum, RecordingModeEnum } from '../types/recording.types';

export class RecordingConfigDto {
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
}

export class StartRecordingDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ValidateNested()
  @Type(() => RecordingConfigDto)
  config: RecordingConfigDto;
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