import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { marked } from 'marked';

interface DocumentationResult {
  content: string;
  markdown: string;
  lastModified: string;
}

interface DocumentationError {
  error: string;
  details: string;
}

@Injectable()
export class DocumentationService implements OnModuleInit {
  private readonly logger = new Logger(DocumentationService.name);

  onModuleInit() {
    // Configurar marked para GitHub Flavored Markdown
    marked.setOptions({
      gfm: true,
      breaks: true
    });
  }

  /**
   * Lê o README.md e converte para HTML
   */
  async getDocumentation(): Promise<DocumentationResult | DocumentationError> {
    try {
      // Caminho relativo considerando estrutura NestJS compilada (dist/)
      const readmePath = join(__dirname, '../../../README.md');

      const readmeContent = readFileSync(readmePath, 'utf8');

      // Converter Markdown para HTML
      const htmlContent = await marked.parse(readmeContent);

      // Obter timestamp de modificação
      const lastModified = new Date().toISOString();

      return {
        content: htmlContent,
        markdown: readmeContent,
        lastModified
      };
    } catch (error: any) {
      this.logger.error('Erro ao carregar documentação:', error);

      return {
        error: 'Não foi possível carregar a documentação',
        details: error.message
      };
    }
  }
}