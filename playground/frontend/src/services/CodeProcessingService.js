import ConstantsManager from './ConstantsManager.js';

/**
 * Serviço responsável pelo processamento de código JavaScript
 * Aplica princípios SOLID:
 * - SRP: Responsabilidade única de processar código
 * - OCP: Aberto para extensão (novos tipos de processamento)
 * - DIP: Depende de abstrações (ConstantsManager)
 */
export default class CodeProcessingService {
  constructor(constantsManager) {
    this.constantsManager = constantsManager;
  }

  /**
   * Processa código aplicando constantes e validações
   * @param {string} code - Código a ser processado
   * @param {string} context - Contexto de execução (automation, footer, session)
   * @returns {CodeProcessingResult}
   */
  processCode(code, context = 'unknown') {
    const result = new CodeProcessingResult();
    
    // Validação básica
    if (!code || typeof code !== 'string') {
      result.addError('Código inválido ou vazio');
      return result;
    }

    const trimmedCode = this.cleanCode(code);
    if (!trimmedCode) {
      result.addError('Nenhum código executável encontrado');
      return result;
    }

    // Obter constantes
    const constants = this.constantsManager.getConstants();
    
    // Validar uso de constantes
    const validation = ConstantsManager.validateConstantUsage(code, constants);
    
    if (!validation.isValid) {
      result.addError(`Constantes não definidas: ${validation.undefinedConstants.join(', ')}`);
      return result;
    }

    // Processar constantes
    const processedCode = ConstantsManager.processConstants(code, constants);
    
    result.setSuccess(processedCode, validation.usedConstants, context);
    return result;
  }

  /**
   * Remove comentários e espaços em branco para validação
   * @param {string} code 
   * @returns {string}
   */
  cleanCode(code) {
    return code
      .replace(/\/\/.*$/gm, '') // Remove comentários de linha
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comentários de bloco
      .trim();
  }

  /**
   * Verifica se o código contém conteúdo executável
   * @param {string} code 
   * @returns {boolean}
   */
  hasExecutableContent(code) {
    const cleaned = this.cleanCode(code);
    return cleaned.length > 0 && !cleaned.startsWith('//');
  }

  /**
   * Processa múltiplos blocos de código (para execução de sessão completa)
   * @param {Object} codeBlocks - { header: string, automation: string, footer: string }
   * @returns {CodeProcessingResult}
   */
  processSessionCode(codeBlocks) {
    const result = new CodeProcessingResult();
    const { header = '', automation = '', footer = '' } = codeBlocks;
    
    const combinedCode = `${header}\n\n${automation}\n\n${footer}`;
    
    // Verificar se há código customizado (não apenas templates padrão)
    if (!this.hasCustomCode(combinedCode)) {
      result.addError('Nenhum código customizado encontrado');
      return result;
    }

    return this.processCode(combinedCode, 'session');
  }

  /**
   * Verifica se há código customizado (não apenas templates)
   * @param {string} code 
   * @returns {boolean}
   */
  hasCustomCode(code) {
    return code && 
           code.trim() && 
           !code.includes('// Configure os parâmetros acima');
  }
}

/**
 * Classe que representa o resultado do processamento de código
 * Encapsula o estado e resultado da operação
 */
class CodeProcessingResult {
  constructor() {
    this.isValid = false;
    this.processedCode = '';
    this.usedConstants = [];
    this.errors = [];
    this.context = '';
  }

  /**
   * Marca o resultado como sucesso
   * @param {string} processedCode 
   * @param {string[]} usedConstants 
   * @param {string} context 
   */
  setSuccess(processedCode, usedConstants, context) {
    this.isValid = true;
    this.processedCode = processedCode;
    this.usedConstants = usedConstants;
    this.context = context;
  }

  /**
   * Adiciona um erro ao resultado
   * @param {string} error 
   */
  addError(error) {
    this.isValid = false;
    this.errors.push(error);
  }

  /**
   * Retorna todos os erros como string
   * @returns {string}
   */
  getErrorMessage() {
    return this.errors.join('; ');
  }

  /**
   * Verifica se há constantes utilizadas
   * @returns {boolean}
   */
  hasUsedConstants() {
    return this.usedConstants.length > 0;
  }
}

export { CodeProcessingResult };
