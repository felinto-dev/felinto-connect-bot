import { IsString, IsBoolean, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ExportOptions } from '../types/export.types';

export enum ExportFormat {
  JSON = 'json',
  PUPPETEER = 'puppeteer',
  PLAYWRIGHT = 'playwright',
  SELENIUM = 'selenium',
}

export class ExportOptionsDto {
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @IsBoolean()
  @Type(() => Boolean)
  includeScreenshots: boolean = false;

  @IsBoolean()
  @Type(() => Boolean)
  minifyOutput: boolean = false;

  @IsBoolean()
  @Type(() => Boolean)
  addComments: boolean = false;
}

export class ExportRecordingDto {
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @IsEnum(ExportFormat)
  format: ExportFormat;

  @IsBoolean()
  @Type(() => Boolean)
  includeScreenshots: boolean = false;

  @IsBoolean()
  @Type(() => Boolean)
  minifyOutput: boolean = false;

  @IsBoolean()
  @Type(() => Boolean)
  addComments: boolean = false;

  /**
   * Convert ExportRecordingDto to ExportOptions instance
   * This method ensures compatibility with the existing ExportService
   */
  toExportOptions(): ExportOptions {
    return {
      format: this.format as 'json' | 'puppeteer' | 'playwright' | 'selenium',
      includeScreenshots: this.includeScreenshots,
      minifyOutput: this.minifyOutput,
      addComments: this.addComments,
    };
  }
}