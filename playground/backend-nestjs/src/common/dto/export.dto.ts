import { IsString, IsBoolean, IsEnum, IsNotEmpty } from 'class-validator';

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

  @IsBoolean()
  includeScreenshots: boolean;

  @IsBoolean()
  minifyOutput: boolean;

  @IsBoolean()
  addComments: boolean;
}