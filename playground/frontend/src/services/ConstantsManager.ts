interface Constant {
  name: string;
  value: string;
}

interface ConstantValidationResult {
  usedConstants: string[];
  undefinedConstants: string[];
  isValid: boolean;
}

export default class ConstantsManager {
  private app: any;
  private constants: Map<string, Constant>;
  private constantsList: HTMLElement | null;
  private constantCounter: number;

  constructor(app: any) {
    this.app = app;
    this.constants = new Map();
    this.constantsList = null;
    this.constantCounter = 0;
    
    this.init();
  }

  init(): void {
    this.constantsList = document.getElementById('constantsList');
    
    this.setupEventListeners();
    this.loadConstants();
    this.updateEmptyState();
  }

  setupEventListeners(): void {
    const addBtn = document.getElementById('addConstantBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addConstant());
    }
  }

  generateId(): string {
    return `constant_${Date.now()}_${++this.constantCounter}`;
  }

  addConstant(name: string = '', value: string = '', focus: boolean = true, shouldSave: boolean = true): string {
    const id = this.generateId();
    const constantElement = this.createConstantElement(id, name, value);
    
    if (this.constantsList) {
      this.constantsList.appendChild(constantElement);
    }
    this.constants.set(id, { name, value });
    
    this.updateEmptyState();
    
    if (focus && !name) {
      const nameInput = constantElement.querySelector<HTMLInputElement>('.constant-name');
      nameInput?.focus();
    }
    
    if (shouldSave) {
      this.saveConstants();
    }
    return id;
  }

  createConstantElement(id: string, name: string, value: string): HTMLElement {
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

    const nameInput = constantItem.querySelector<HTMLInputElement>('.constant-name');
    const valueInput = constantItem.querySelector<HTMLInputElement>('.constant-value');
    const removeBtn = constantItem.querySelector<HTMLButtonElement>('.remove-constant-btn');

    nameInput?.addEventListener('input', (e) => this.updateConstant(id, 'name', (e.target as HTMLInputElement).value));
    nameInput?.addEventListener('blur', (e) => this.validateConstantName(e.target as HTMLInputElement));
    
    valueInput?.addEventListener('input', (e) => this.updateConstant(id, 'value', (e.target as HTMLInputElement).value));
    
    removeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.removeConstant(id);
    });

    setTimeout(() => {
      window.lucide?.createIcons({ nameAttr: 'data-lucide' });
    }, 10);

    return constantItem;
  }

  updateConstant(id: string, field: keyof Constant, value: string): void {
    const constant = this.constants.get(id);
    if (constant) {
      constant[field] = value;
      this.constants.set(id, constant);
      this.saveConstants();
      
      if (field === 'name') {
        const element = document.querySelector<HTMLInputElement>(`[data-constant-id="${id}"] .constant-name`);
        if (element) {
          this.validateConstantName(element);
        }
      }
    }
  }

  validateConstantName(input: HTMLInputElement): boolean {
    const name = input.value.trim();
    const isValid = this.isValidConstantName(name);
    
    input.classList.toggle('invalid', !isValid);
    
    const constantItem = input.closest('.constant-item');
    constantItem?.classList.toggle('error', !isValid);
    constantItem?.classList.toggle('success', isValid && name.length > 0);
    
    return isValid;
  }

  isValidConstantName(name: string): boolean {
    if (!name || name.length === 0) return false;
    
    const validNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!validNameRegex.test(name)) return false;
    
    const currentNames = Array.from(this.constants.values()).map(c => c.name).filter(n => n && n.length > 0);
    const duplicates = currentNames.filter(n => n === name);
    
    return duplicates.length <= 1;
  }

  removeConstant(id: string): void {
    const element = document.querySelector<HTMLElement>(`[data-constant-id="${id}"]`);
    
    if (element) {
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

  updateConstantLabels(): void {
    if (!this.constantsList) return;
    const items = this.constantsList.querySelectorAll('.constant-item');
    items.forEach((item, index) => {
      const label = item.querySelector<HTMLDivElement>('.constant-label');
      if (label) {
        label.textContent = `Constante ${index + 1}:`;
      }
    });
  }

  updateEmptyState(): void {
    if (!this.constantsList) return;
    const constantItems = this.constantsList.querySelectorAll('.constant-item');
    const isEmpty = constantItems.length === 0;
    const hasEmptyState = this.constantsList.querySelector('.empty-state-content');
    
    if (isEmpty && !hasEmptyState) {
      this.constantsList.innerHTML = `
        <div class="empty-state-content">
          <span class="empty-state-text">Nenhuma constante definida.</span>
          <button type="button" class="add-constant-btn empty-state-btn" id="emptyStateAddBtn">
            <i data-lucide="plus" class="btn-icon"></i>
            Adicionar
          </button>
        </div>
      `;
      
      const emptyAddBtn = document.getElementById('emptyStateAddBtn');
      if (emptyAddBtn) {
        emptyAddBtn.addEventListener('click', () => this.addConstant());
      }
      
      setTimeout(() => {
        window.lucide?.createIcons({ nameAttr: 'data-lucide' });
      }, 10);
    } else if (!isEmpty && hasEmptyState) {
      hasEmptyState.remove();
    }
  }

  getConstants(): Record<string, string> {
    const result: Record<string, string> = {};
    
    this.constants.forEach((constant) => {
      if (constant.name && constant.name.trim().length > 0) {
        const name = constant.name.trim();
        if (this.isValidConstantName(name)) {
          result[name] = constant.value || '';
        }
      }
    });
    
    return result;
  }

  getConstantsForConfig(): Record<string, string> {
    return this.getConstants();
  }

  setConstants(constants: Record<string, string>, shouldSave: boolean = true): void {
    if (this.constantsList) {
      this.constantsList.innerHTML = '';
    }
    this.constants.clear();
    
    if (constants && typeof constants === 'object') {
      Object.entries(constants).forEach(([name, value]) => {
        this.addConstant(name, value, false, shouldSave);
      });
    }
    
    this.updateEmptyState();
  }

  saveConstants(): void {
    if (this.app.configService) {
      this.app.configService.saveConfig();
    }
  }

  loadConstants(): void {
    const config = this.app.configService.loadConfig();
    if (config.constants && Object.keys(config.constants).length > 0) {
      this.setConstants(config.constants, false);
    } else {
      if (this.constantsList) {
        this.constantsList.innerHTML = '';
      }
      this.updateEmptyState();
    }
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static processConstants(code: string, constants: Record<string, string>): string {
    if (!code || !constants) return code;
    
    const constantPattern = /(['"]?)\{\{\s*\$([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}(['"]?)/g;
    
    return code.replace(constantPattern, (match, openQuote, variableName, closeQuote) => {
      if (Object.prototype.hasOwnProperty.call(constants, variableName)) {
        const value = constants[variableName];
        
        if (openQuote && closeQuote) {
          if (typeof value === 'string') {
            return openQuote + value.replace(/"/g, '\\"').replace(/'/g, "\\'") + closeQuote;
          } else {
            return openQuote + String(value) + closeQuote;
          }
        } else {
          if (typeof value === 'string') {
            return JSON.stringify(value);
          } else {
            return String(value);
          }
        }
      } else {
        console.warn(`Constante não encontrada: ${variableName}`);
        return match;
      }
    });
  }

  static validateConstantUsage(code: string, availableConstants: Record<string, string>): ConstantValidationResult {
    const constantPattern = /\{\{\s*\$([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    const usedConstants: string[] = [];
    const undefinedConstants: string[] = [];
    
    let match;
    while ((match = constantPattern.exec(code)) !== null) {
      const constantName = match[1];
      
      if (Object.prototype.hasOwnProperty.call(availableConstants, constantName)) {
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
