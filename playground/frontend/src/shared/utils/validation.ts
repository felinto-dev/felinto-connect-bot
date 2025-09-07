import type { 
  RecordingConfig, 
  RecordingEventType,
  RecordingMode 
} from '../types/recording';
import { RECORDING_LIMITS, ALL_RECORDING_EVENTS } from '../constants/recording';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ValidationService {
  
  /**
   * Validar configuração de gravação
   */
  static validateRecordingConfig(config: Partial<RecordingConfig>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar eventos selecionados
    if (!config.events || config.events.length === 0) {
      errors.push('Selecione pelo menos um tipo de evento para gravar');
    } else {
      const invalidEvents = config.events.filter(event => !ALL_RECORDING_EVENTS.includes(event));
      if (invalidEvents.length > 0) {
        errors.push(`Tipos de evento inválidos: ${invalidEvents.join(', ')}`);
      }
    }

    // Validar modo de gravação
    if (config.mode && !['smart', 'detailed', 'minimal'].includes(config.mode)) {
      errors.push(`Modo de gravação inválido: ${config.mode}`);
    }

    // Validar delay
    if (config.delay !== undefined) {
      if (config.delay < RECORDING_LIMITS.MIN_DELAY) {
        errors.push(`Delay mínimo é ${RECORDING_LIMITS.MIN_DELAY}ms`);
      }
      if (config.delay > RECORDING_LIMITS.MAX_DELAY) {
        errors.push(`Delay máximo é ${RECORDING_LIMITS.MAX_DELAY}ms`);
      }
    }

    // Validar screenshot interval
    if (config.screenshotInterval !== undefined) {
      if (config.screenshotInterval < RECORDING_LIMITS.MIN_SCREENSHOT_INTERVAL) {
        warnings.push(`Intervalo de screenshot muito baixo, recomendado: ${RECORDING_LIMITS.MIN_SCREENSHOT_INTERVAL}ms`);
      }
      if (config.screenshotInterval > RECORDING_LIMITS.MAX_SCREENSHOT_INTERVAL) {
        warnings.push(`Intervalo de screenshot muito alto, recomendado: ${RECORDING_LIMITS.MAX_SCREENSHOT_INTERVAL}ms`);
      }
    }

    // Validar limites
    if (config.maxEvents !== undefined && config.maxEvents > RECORDING_LIMITS.MAX_EVENTS) {
      warnings.push(`Limite de eventos muito alto, máximo recomendado: ${RECORDING_LIMITS.MAX_EVENTS}`);
    }

    if (config.maxDuration !== undefined && config.maxDuration > RECORDING_LIMITS.MAX_DURATION) {
      warnings.push(`Duração máxima muito alta, máximo recomendado: ${RECORDING_LIMITS.MAX_DURATION / 60000} minutos`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validar arquivo JSON de gravação
   */
  static validateRecordingFile(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Verificar estrutura básica
    if (!data || typeof data !== 'object') {
      errors.push('Arquivo não é um JSON válido');
      return { isValid: false, errors, warnings };
    }

    // Verificar metadados
    if (!data.metadata) {
      errors.push('Arquivo não possui metadados de gravação');
    } else {
      if (!data.metadata.recordingId) {
        warnings.push('ID da gravação não encontrado nos metadados');
      }
      if (!data.metadata.version) {
        warnings.push('Versão do arquivo não especificada, pode haver incompatibilidades');
      }
    }

    // Verificar eventos
    if (!data.events || !Array.isArray(data.events)) {
      errors.push('Arquivo não possui array de eventos válido');
    } else {
      if (data.events.length === 0) {
        warnings.push('Gravação não possui eventos para reproduzir');
      }

      // Validar estrutura dos eventos
      const invalidEvents = data.events.filter((event: any, index: number) => {
        if (!event.id || !event.type || !event.timestamp) {
          return true;
        }
        return false;
      });

      if (invalidEvents.length > 0) {
        errors.push(`${invalidEvents.length} eventos possuem estrutura inválida`);
      }

      // Verificar tipos de eventos
      const eventTypes = data.events.map((event: any) => event.type);
      const uniqueTypes = [...new Set(eventTypes)];
      const unsupportedTypes = uniqueTypes.filter(type => !ALL_RECORDING_EVENTS.includes(type));
      
      if (unsupportedTypes.length > 0) {
        warnings.push(`Tipos de evento não suportados serão ignorados: ${unsupportedTypes.join(', ')}`);
      }
    }

    // Verificar timeline
    if (!data.timeline) {
      warnings.push('Informações de timeline não encontradas');
    } else {
      if (!data.timeline.startTime || !data.timeline.duration) {
        warnings.push('Informações de timing incompletas');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validar sessão ativa
   */
  static validateActiveSession(sessionId: string | null): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!sessionId) {
      errors.push('Nenhuma sessão ativa. Crie uma sessão no Playground primeiro.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validar opções de exportação
   */
  static validateExportOptions(options: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!options.format) {
      errors.push('Formato de exportação é obrigatório');
    } else if (!['json', 'puppeteer'].includes(options.format)) {
      errors.push(`Formato não suportado: ${options.format}`);
    }

    if (options.format === 'puppeteer' && options.includeScreenshots) {
      warnings.push('Screenshots em scripts Puppeteer são convertidos para comandos de captura');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sanitizar entrada do usuário
   */
  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/[<>]/g, '') // Remove < e >
      .substring(0, 1000); // Limitar tamanho
  }

  /**
   * Validar nome de arquivo
   */
  static validateFilename(filename: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (filename.length === 0) {
      return { isValid: true, errors, warnings }; // Filename vazio é válido (será gerado automaticamente)
    }

    // Caracteres inválidos
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(filename)) {
      errors.push('Nome do arquivo contém caracteres inválidos');
    }

    // Tamanho
    if (filename.length > 255) {
      errors.push('Nome do arquivo muito longo (máximo 255 caracteres)');
    }

    // Nomes reservados (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(filename.toUpperCase())) {
      errors.push('Nome do arquivo é reservado pelo sistema');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Mostrar resultado de validação
   */
  static showValidationResult(result: ValidationResult, context: string = 'Validação'): void {
    if (!result.isValid && window.notificationManager) {
      result.errors.forEach(error => {
        window.notificationManager.error(context, error);
      });
    }

    if (result.warnings.length > 0 && window.notificationManager) {
      result.warnings.forEach(warning => {
        window.notificationManager.warning(context, warning);
      });
    }
  }
}
