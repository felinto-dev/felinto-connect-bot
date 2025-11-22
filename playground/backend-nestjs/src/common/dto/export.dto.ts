import { IsString, IsBoolean, IsEnum, IsNotEmpty, IsObject, validate } from 'class-validator';
import { ExportOptions } from '../types/export.types';
import { ApiProperty } from '@nestjs/swagger';

export enum ExportFormat {
  JSON = 'json',
  PUPPETEER = 'puppeteer',
  // PLAYWRIGHT = 'playwright', // Não implementado ainda
  // SELENIUM = 'selenium',    // Não implementado ainda
}

export class ExportOptionsDto {
  @ApiProperty({ description: 'Formato de exportação', enum: ExportFormat, example: 'json' })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  /**
   * Whether to include screenshots in the export
   * Default: false
   * This field is required with a default value to ensure predictable behavior
   */
  @ApiProperty({ description: 'Inclui screenshots base64 no arquivo exportado (aumenta tamanho)', default: false })
  @IsBoolean()
  includeScreenshots: boolean = false;

  /**
   * Whether to minify the output file
   * Default: false
   * This field is required with a default value to ensure predictable behavior
   */
  @ApiProperty({ description: 'Minifica JSON/código para reduzir tamanho', default: false })
  @IsBoolean()
  minifyOutput: boolean = false;

  /**
   * Whether to add explanatory comments to the output
   * Default: false
   * This field is required with a default value to ensure predictable behavior
   */
  @ApiProperty({ description: 'Adiciona comentários explicativos no código Puppeteer', default: false })
  @IsBoolean()
  addComments: boolean = false;

  /**
   * Convert ExportOptionsDto to ExportOptions domain type
   * This method ensures compatibility with services expecting domain types
   */
  toExportOptions(): ExportOptions {
    return {
      format: this.format as 'json' | 'puppeteer',
      includeScreenshots: this.includeScreenshots,
      minifyOutput: this.minifyOutput,
      addComments: this.addComments,
    };
  }
}

export class ExportRecordingDto {
  @ApiProperty({ description: 'ID da gravação a exportar', example: 'rec-abc123' })
  @IsString()
  @IsNotEmpty()
  recordingId: string;

  @ApiProperty({ description: 'Opções de exportação', type: () => ExportOptionsDto })
  @IsObject()
  options: ExportOptionsDto;

  /**
   * Convert ExportRecordingDto to extract recordingId and ExportOptions
   * This method ensures compatibility with the Express backend format
   */
  toExportRequest(): { recordingId: string; options: ExportOptions } {
    return {
      recordingId: this.recordingId,
      options: this.options.toExportOptions()
    };
  }
}