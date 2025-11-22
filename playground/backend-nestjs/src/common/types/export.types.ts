export interface ExportOptions {
  format: 'json' | 'puppeteer'; // Apenas formatos implementados
  includeScreenshots: boolean;
  minifyOutput: boolean;
  addComments: boolean;
}

export interface ExportResult {
  format: string;
  content: string;
  filename: string;
  size: number;
  metadata: {
    exportedAt: number;
    originalRecordingId: string;
    eventCount: number;
  };
}