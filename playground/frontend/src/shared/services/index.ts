// Importar as classes para uso interno
import ApiService from './ApiService';
import ConfigService from './ConfigService';
import ConstantsManager from './ConstantsManager';
import CodeProcessingService from './CodeProcessingService';

// Exportar as classes individualmente
export { default as ApiService } from './ApiService';
export { default as ConfigService } from './ConfigService';
export { default as ConstantsManager } from './ConstantsManager';
export { default as CodeProcessingService } from './CodeProcessingService';
export { EditorExpansionManager } from './EditorExpansionManager';
export { CodeMirrorEditorStrategy, SessionDataEditorStrategy } from './EditorStrategies';

// Classe para centralizar serviços compartilhados
export class SharedServices {
  public apiService: ApiService;
  public configService: ConfigService;
  public constantsManager: ConstantsManager;
  public codeProcessingService: CodeProcessingService;

  constructor() {
    this.apiService = new ApiService();
    this.configService = new ConfigService(this); // Passa a referência de SharedServices
    this.constantsManager = new ConstantsManager(this); // Passa a referência de SharedServices
    this.codeProcessingService = new CodeProcessingService(this.constantsManager);
    
    // Inicializar ConstantsManager após todos os serviços serem criados
    // Usar setTimeout para garantir que o DOM esteja pronto
    setTimeout(() => {
      this.constantsManager.init();
    }, 0);
  }
}
