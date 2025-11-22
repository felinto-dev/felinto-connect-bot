import { Injectable } from '@nestjs/common';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import type {
  RecordingData,
  RecordingEvent
} from '../common/types/recording.types';
import type {
  ExportOptions,
  ExportResult
} from '../common/types/export.types';

@Injectable()
export class ExportService {
  constructor(private readonly websocketGateway: WebsocketGateway) {}

  /**
   * Exportar gravação no formato especificado
   */
  async exportRecording(recording: RecordingData, options: ExportOptions): Promise<ExportResult> {
    console.log(`📤 Exportando gravação ${recording.id} no formato: ${options.format}`);

    let content: string;
    let filename: string;

    switch (options.format) {
      case 'json':
        content = this.exportAsJSON(recording, options);
        filename = `recording_${recording.id}.json`;
        break;

      case 'puppeteer':
        content = this.exportAsPuppeteer(recording, options);
        filename = `recording_${recording.id}_puppeteer.js`;
        break;

      default:
        throw new Error(`Formato de exportação não suportado: ${options.format}`);
    }

    const result: ExportResult = {
      format: options.format,
      content,
      filename,
      size: Buffer.byteLength(content, 'utf8'),
      metadata: {
        exportedAt: Date.now(),
        originalRecordingId: recording.id,
        eventCount: recording.events.length
      }
    };

    console.log(`✅ Exportação concluída: ${filename} (${Math.round(result.size / 1024)}KB)`);

    return result;
  }

  /**
   * Exportar como JSON
   */
  private exportAsJSON(recording: RecordingData, options: ExportOptions): string {
    const exportData = {
      metadata: {
        recordingId: recording.id,
        sessionId: recording.sessionId,
        exportedAt: new Date().toISOString(),
        format: 'json',
        version: '1.0.0',
        ...recording.metadata
      },
      config: recording.config,
      timeline: {
        startTime: recording.startTime,
        endTime: recording.endTime,
        duration: recording.duration,
        totalEvents: recording.events.length
      },
      events: options.includeScreenshots ?
        recording.events :
        recording.events.map(event => {
          const { screenshot, ...eventWithoutScreenshot } = event;
          return eventWithoutScreenshot;
        }),
      statistics: this.calculateExportStats(recording)
    };

    return options.minifyOutput ?
      JSON.stringify(exportData) :
      JSON.stringify(exportData, null, 2);
  }

  /**
   * Exportar como script Puppeteer
   */
  private exportAsPuppeteer(recording: RecordingData, options: ExportOptions): string {
    const events = recording.events;
    const config = recording.config;

    let script = '';

    // Header do script
    if (options.addComments) {
      script += `// Gravação gerada automaticamente\n`;
      script += `// ID da gravação: ${recording.id}\n`;
      script += `// Data: ${new Date().toISOString()}\n`;
      script += `// Total de eventos: ${events.length}\n`;
      script += `// Duração: ${Math.round((recording.duration || 0) / 1000)}s\n\n`;
    }

    // Imports e setup inicial
    script += `const puppeteer = require('puppeteer');\n\n`;
    script += `(async () => {\n`;
    script += `  const browser = await puppeteer.launch({ headless: false });\n`;
    script += `  const page = await browser.newPage();\n\n`;

    // Configurar viewport se disponível
    if (recording.metadata.viewport) {
      script += `  await page.setViewport(${JSON.stringify(recording.metadata.viewport)});\n\n`;
    }

    // Navegar para URL inicial se disponível
    if (recording.metadata.initialUrl) {
      script += `  await page.goto('${recording.metadata.initialUrl}');\n\n`;
    }

    if (options.addComments) {
      script += `  // Reproduzir eventos gravados\n`;
    }

    // Processar eventos
    let lastTimestamp = recording.startTime;

    events.forEach((event, index) => {
      // Pular screenshots se não incluídos
      if (!options.includeScreenshots && event.type === 'screenshot') {
        return;
      }

      // Calcular delay entre eventos
      const delay = event.timestamp - lastTimestamp;
      if (delay > 100 && config.delay > 0) { // Apenas delays significativos
        script += `  await page.waitForTimeout(${Math.min(delay, 5000)});\n`;
      }

      // Gerar código para o evento
      script += this.generatePuppeteerEventCode(event, options.addComments);

      lastTimestamp = event.timestamp;
    });

    // Footer do script
    if (options.addComments) {
      script += `\n  // Finalizar\n`;
    }
    script += `  await page.waitForTimeout(1000);\n`;
    script += `  await browser.close();\n`;
    script += `})().catch(console.error);\n`;

    return script;
  }

  /**
   * Gerar código Puppeteer para um evento específico
   */
  private generatePuppeteerEventCode(event: RecordingEvent, addComments: boolean): string {
    let code = '';

    if (addComments) {
      code += `\n  // Evento: ${event.type} (${new Date(event.timestamp).toISOString()})\n`;
    }

    switch (event.type) {
      case 'click':
        if (event.selector) {
          code += `  await page.click('${event.selector}');\n`;
        } else if (event.coordinates) {
          code += `  await page.mouse.click(${event.coordinates.x}, ${event.coordinates.y});\n`;
        }
        break;

      case 'type':
        if (event.selector && event.value) {
          code += `  await page.type('${event.selector}', '${this.escapeString(event.value)}');\n`;
        }
        break;

      case 'navigation':
        if (event.url) {
          code += `  await page.goto('${event.url}');\n`;
        }
        break;


      case 'key_press':
        if (event.value) {
          code += `  await page.keyboard.press('${event.value}');\n`;
        }
        break;

      case 'form_submit':
        if (event.selector) {
          code += `  await page.evaluate((selector) => {\n`;
          code += `    const form = document.querySelector(selector);\n`;
          code += `    if (form) form.submit();\n`;
          code += `  }, '${event.selector}');\n`;
        }
        break;

      case 'screenshot':
        if (addComments) {
          code += `  // Screenshot capturado durante gravação\n`;
        }
        code += `  await page.screenshot({ path: 'screenshot_${Date.now()}.png' });\n`;
        break;

      case 'page_load':
        code += `  await page.waitForLoadState('domcontentloaded');\n`;
        break;

      default:
        if (addComments) {
          code += `  // Evento não suportado: ${event.type}\n`;
        }
    }

    return code;
  }

  /**
   * Escapar string para uso em código JavaScript
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Calcular estatísticas para exportação
   */
  private calculateExportStats(recording: RecordingData) {
    const events = recording.events;
    const eventsByType: Record<string, number> = {};
    let screenshotCount = 0;
    let totalSize = 0;

    events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

      if (event.screenshot) {
        screenshotCount++;
        // Estimar tamanho do screenshot em base64
        totalSize += Math.round((event.screenshot.length * 3) / 4);
      }
    });

    return {
      totalEvents: events.length,
      eventsByType,
      screenshotCount,
      estimatedSize: Math.round(totalSize / 1024), // KB
      duration: recording.duration || 0,
      averageEventInterval: events.length > 1 ?
        (recording.duration || 0) / (events.length - 1) : 0
    };
  }

  /**
   * Validar opções de exportação
   */
  validateExportOptions(options: ExportOptions): void {
    const validFormats = ['json', 'puppeteer'];

    if (!validFormats.includes(options.format)) {
      throw new Error(`Formato inválido: ${options.format}. Formatos suportados: ${validFormats.join(', ')}`);
    }

    // Validações específicas por formato
    if (options.format === 'puppeteer' && options.includeScreenshots) {
      console.warn('⚠️ Screenshots em scripts Puppeteer são convertidos para comandos de captura');
    }
  }
}