export default class ConstantsManager {
  constructor(app) {
    this.app = app;
    this.constants = new Map();
    this.constantsContainer = null;
    this.constantsList = null;
    this.constantCounter = 0;
    
    this.init();
  }

  init() {
    this.constantsContainer = document.querySelector('.constants-container');
    this.constantsList = document.getElementById('constantsList');
    
    this.setupEventListeners();
    this.loadConstants();
    this.updateEmptyState();
  }

  setupEventListeners() {
    // Botão adicionar constante
    const addBtn = document.getElementById('addConstantBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addConstant());
    }
  }

  generateId() {
    return `constant_${Date.now()}_${++this.constantCounter}`;
  }

  addConstant(name = '', value = '', focus = true, shouldSave = true) {
    const id = this.generateId();
    const constantElement = this.createConstantElement(id, name, value);
    
    this.constantsList.appendChild(constantElement);
    this.constants.set(id, { name, value });
    
    // Atualizar estado vazio
    this.updateEmptyState();
    
    // Foco no campo nome se estiver vazio
    if (focus && !name) {
      const nameInput = constantElement.querySelector('.constant-name');
      if (nameInput) {
        nameInput.focus();
      }
    }
    
    if (shouldSave) {
      this.saveConstants();
    }
    return id;
  }

  createConstantElement(id, name, value) {
    const constantItem = document.createElement('div');
    constantItem.className = 'constant-item';
    constantItem.setAttribute('data-constant-id', id);
    
    constantItem.innerHTML = `
      <div class="constant-label">Constante ${this.constants.size + 1}:</div>
      <div class="constant-inputs">
        <input type="text" 
               class="constant-name" 
               placeholder="nome_da_constante" 
               value="${this.escapeHtml(name)}"
               data-constant-id="${id}">
        <span class="constant-separator">=</span>
        <input type="text" 
               class="constant-value" 
               placeholder="valor" 
               value="${this.escapeHtml(value)}"
               data-constant-id="${id}">
      </div>
      <button type="button" class="remove-constant-btn" data-constant-id="${id}" title="Remover constante">
        <i data-lucide="trash-2" style="pointer-events: none;"></i>
      </button>
    `;

    // Event listeners para os inputs
    const nameInput = constantItem.querySelector('.constant-name');
    const valueInput = constantItem.querySelector('.constant-value');
    const removeBtn = constantItem.querySelector('.remove-constant-btn');

    nameInput.addEventListener('input', (e) => this.updateConstant(id, 'name', e.target.value));
    nameInput.addEventListener('blur', (e) => this.validateConstantName(e.target));
    
    valueInput.addEventListener('input', (e) => this.updateConstant(id, 'value', e.target.value));
    
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.removeConstant(id);
    });

    // Inicializar ícones Lucide
    setTimeout(() => {
      if (window.lucide) {
        window.lucide.createIcons({ nameAttr: 'data-lucide' });
      }
    }, 10);

    return constantItem;
  }

  updateConstant(id, field, value) {
    const constant = this.constants.get(id);
    if (constant) {
      constant[field] = value;
      this.constants.set(id, constant);
      this.saveConstants();
      
      // Validar nome se for o campo nome
      if (field === 'name') {
        const element = document.querySelector(`[data-constant-id="${id}"] .constant-name`);
        this.validateConstantName(element);
      }
    }
  }

  validateConstantName(input) {
    const name = input.value.trim();
    const isValid = this.isValidConstantName(name);
    
    input.classList.toggle('invalid', !isValid);
    
    const constantItem = input.closest('.constant-item');
    constantItem.classList.toggle('error', !isValid);
    constantItem.classList.toggle('success', isValid && name.length > 0);
    
    return isValid;
  }

  isValidConstantName(name) {
    if (!name || name.length === 0) return false;
    
    // Verificar se é um nome válido (letras, números, underscore, começando com letra ou underscore)
    const validNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!validNameRegex.test(name)) return false;
    
    // Verificar duplicatas
    const currentNames = Array.from(this.constants.values()).map(c => c.name).filter(n => n && n.length > 0);
    const duplicates = currentNames.filter(n => n === name);
    
    return duplicates.length <= 1; // Permitir 1 (o próprio)
  }

  removeConstant(id) {
    const element = document.querySelector(`[data-constant-id="${id}"]`);
    
    if (element) {
      // Animação de remoção
      element.style.transition = 'all 0.3s ease';
      element.style.opacity = '0';
      element.style.transform = 'translateX(-20px)';
      
      setTimeout(() => {
        element.remove();
        this.constants.delete(id);
        this.updateConstantLabels();
        this.updateEmptyState();
        this.saveConstants();
      }, 300);
    }
  }

  updateConstantLabels() {
    const items = this.constantsList.querySelectorAll('.constant-item');
    items.forEach((item, index) => {
      const label = item.querySelector('.constant-label');
      if (label) {
        label.textContent = `Constante ${index + 1}:`;
      }
    });
  }

  updateEmptyState() {
    const constantItems = this.constantsList.querySelectorAll('.constant-item');
    const isEmpty = constantItems.length === 0;
    const hasEmptyState = this.constantsList.querySelector('.empty-state-content');
    
    if (isEmpty && !hasEmptyState) {
      // Criar o estado vazio com botão
      this.constantsList.innerHTML = `
        <div class="empty-state-content">
          <span class="empty-state-text">Nenhuma constante definida.</span>
          <button type="button" class="add-constant-btn empty-state-btn" id="emptyStateAddBtn">
            <i data-lucide="plus" class="btn-icon"></i>
            Adicionar
          </button>
        </div>
      `;
      
      // Adicionar event listener ao botão do estado vazio
      const emptyAddBtn = document.getElementById('emptyStateAddBtn');
      if (emptyAddBtn) {
        emptyAddBtn.addEventListener('click', () => this.addConstant());
      }
      
      // Inicializar ícones Lucide
      setTimeout(() => {
        if (window.lucide) {
          window.lucide.createIcons({ nameAttr: 'data-lucide' });
        }
      }, 10);
    } else if (!isEmpty && hasEmptyState) {
      // Remover o estado vazio se há constantes
      hasEmptyState.remove();
    }
  }



  getConstants() {
    const result = {};
    
    this.constants.forEach((constant, id) => {
      if (constant.name && constant.name.trim().length > 0) {
        const name = constant.name.trim();
        if (this.isValidConstantName(name)) {
          result[name] = constant.value || '';
        }
      }
    });
    
    return result;
  }

  getConstantsForConfig() {
    return this.getConstants();
  }

  setConstants(constants, shouldSave = true) {
    // Limpar constantes existentes
    this.constantsList.innerHTML = '';
    this.constants.clear();
    
    // Adicionar novas constantes
    if (constants && typeof constants === 'object') {
      Object.entries(constants).forEach(([name, value]) => {
        this.addConstant(name, value, false, shouldSave);
      });
    }
    
    // Atualizar estado vazio se não há constantes
    this.updateEmptyState();
  }

  saveConstants() {
    if (this.app.configService) {
      this.app.configService.saveConfig();
    }
  }

  loadConstants() {
    const config = this.app.configService.loadConfig();
    // Verifica se as constantes existem e se o objeto não está vazio
    if (config.constants && Object.keys(config.constants).length > 0) {
      // Não salvar durante o carregamento inicial para evitar sobrescrever outras configurações
      this.setConstants(config.constants, false);
    } else {
      // Garante que a lista esteja visualmente vazia
      this.constantsList.innerHTML = '';
      this.updateEmptyState();
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Método para processar constantes no código
  static processConstants(code, constants) {
    if (!code || !constants) return code;
    
    let processedCode = code;
    
    // Regex para encontrar padrões {{ $variavel }} - incluindo contexto de aspas
    const constantPattern = /(['"]?)\{\{\s*\$([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}(['"]?)/g;
    
    processedCode = processedCode.replace(constantPattern, (match, openQuote, variableName, closeQuote) => {
      if (constants.hasOwnProperty(variableName)) {
        const value = constants[variableName];
        
        // Se já está entre aspas, substituir apenas o valor
        if (openQuote && closeQuote) {
          if (typeof value === 'string') {
            // Escapar aspas internas se necessário
            return openQuote + value.replace(/"/g, '\\"').replace(/'/g, "\\'") + closeQuote;
          } else {
            // Para números/booleans em contexto de string, converter para string
            return openQuote + String(value) + closeQuote;
          }
        } else {
          // Se não está entre aspas, aplicar formatação adequada
          if (typeof value === 'string') {
            return JSON.stringify(value);
          } else {
            return String(value);
          }
        }
      } else {
        // Constante não encontrada - manter original
        console.warn(`Constante não encontrada: ${variableName}`);
        return match;
      }
    });
    
    return processedCode;
  }

  // Método para validar uso de constantes no código
  static validateConstantUsage(code, availableConstants) {
    const constantPattern = /\{\{\s*\$([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    const usedConstants = [];
    const undefinedConstants = [];
    
    let match;
    while ((match = constantPattern.exec(code)) !== null) {
      const constantName = match[1];
      
      if (availableConstants.hasOwnProperty(constantName)) {
        if (!usedConstants.includes(constantName)) {
          usedConstants.push(constantName);
        }
      } else {
        if (!undefinedConstants.includes(constantName)) {
          undefinedConstants.push(constantName);
        }
      }
    }
    
    return {
      usedConstants,
      undefinedConstants,
      isValid: undefinedConstants.length === 0
    };
  }
}
