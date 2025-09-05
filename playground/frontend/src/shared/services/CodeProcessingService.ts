import ConstantsManager from './ConstantsManager';

/**
 * Classe que representa o resultado do processamento de código
 * Encapsula o estado e resultado da operação
 */
export class CodeProcessingResult {
  public isValid: boolean = false;
  public processedCode: string = '';
  public usedConstants: string[] = [];
  public errors: string[] = [];
  public context: string = '';

  /**
   * Marca o resultado como sucesso
   */
  setSuccess(processedCode: string, usedConstants: string[], context: string): void {
    this.isValid = true;
    this.processedCode = processedCode;
    this.usedConstants = usedConstants;
    this.context = context;
  }

  /**
   * Adiciona um erro ao resultado
   */
  addError(error: string): void {
    this.isValid = false;
    this.errors.push(error);
  }

  /**
   * Retorna todos os erros como string
   */
  getErrorMessage(): string {
    return this.errors.join('; ');
  }

  /**
   * Verifica se há constantes utilizadas
   */
  hasUsedConstants(): boolean {
    return this.usedConstants.length > 0;
  }
}

/**
 * Serviço responsável pelo processamento de código JavaScript
 */
export default class CodeProcessingService {
  private constantsManager: ConstantsManager;

  constructor(constantsManager: ConstantsManager) {
    this.constantsManager = constantsManager;
  }

  /**
   * Processa código aplicando constantes e validações
   */
  processCode(code: string, context: string = 'unknown'): CodeProcessingResult {
    const result = new CodeProcessingResult();
    
    if (!code || typeof code !== 'string') {
      result.addError('Código inválido ou vazio');
      return result;
    }

    const trimmedCode = this.cleanCode(code);
    if (!trimmedCode) {
      result.addError('Nenhum código executável encontrado');
      return result;
    }

    const constants = this.constantsManager.getConstants();
    const validation = ConstantsManager.validateConstantUsage(code, constants);
    
    if (!validation.isValid) {
      result.addError(`Constantes não definidas: ${validation.undefinedConstants.join(', ')}`);
      return result;
    }

    const processedCode = ConstantsManager.processConstants(code, constants);
    
    result.setSuccess(processedCode, validation.usedConstants, context);
    return result;
  }

  /**
   * Remove comentários e espaços em branco para validação
   */
  cleanCode(code: string): string {
    return code
      .replace(/\/\/.*$/gm, '') // Remove comentários de linha
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comentários de bloco
      .trim();
  }

  /**
   * Verifica se o código contém conteúdo executável
   */
  hasExecutableContent(code: string): boolean {
    const cleaned = this.cleanCode(code);
    return cleaned.length > 0 && !cleaned.startsWith('//');
  }

  /**
   * Processa múltiplos blocos de código (para execução de sessão completa)
   */
  processSessionCode(codeBlocks: { header?: string; automation?: string; footer?: string }): CodeProcessingResult {
    const result = new CodeProcessingResult();
    const { header = '', automation = '', footer = '' } = codeBlocks;
    
    const combinedCode = `${header}\n\n${automation}\n\n${footer}`;
    
    if (!this.hasCustomCode(combinedCode)) {
      result.addError('Nenhum código customizado encontrado');
      return result;
    }

    return this.processCode(combinedCode, 'session');
  }

  /**
   * Verifica se há código customizado (não apenas templates)
   */
  hasCustomCode(code: string): boolean {
    return !!(code && code.trim() && !code.includes('// Configure os parâmetros acima'));
  }
}
