import { IsString, IsBoolean, IsEnum, IsNotEmpty } from 'class-validator';
import { ExportOptions } from '../types/export.types';

export enum ExportFormat {
  JSON = 'json',
  PUPPETEER = 'puppeteer',
  PLAYWRIGHT = 'playwright',
  SELENIUM = 'selenium',
}


export class ExportRecordingDto {
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @IsEnum(ExportFormat)
  format: ExportFormat;

  /**
   * Whether to include screenshots in the export
   * Default: false
   * This field is required with a default value to ensure predictable behavior
   */
  @IsBoolean()
  includeScreenshots: boolean = false;

  /**
   * Whether to minify the output file
   * Default: false
   * This field is required with a default value to ensure predictable behavior
   */
  @IsBoolean()
  minifyOutput: boolean = false;

  /**
   * Whether to add explanatory comments to the output
   * Default: false
   * This field is required with a default value to ensure predictable behavior
   */
  @IsBoolean()
  addComments: boolean = false;

  /**
   * Convert ExportRecordingDto to ExportOptions domain type
   * This method ensures compatibility with services expecting domain types
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