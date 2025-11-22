import { IsString, IsBoolean, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsNotEmpty()
  @Type(() => ExportOptionsDto)
  options: ExportOptionsDto;
}