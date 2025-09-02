/**
 * ExpandToggleButton - Componente reutilizável para botões de expansão de editores
 * 
 * Segue princípios de:
 * - Single Responsibility: Apenas cria e gerencia botões de toggle
 * - Open/Closed: Extensível através de configurações
 * - Dependency Inversion: Não depende de implementações específicas
 */

export class ExpandToggleButton {
  /**
   * Cria um botão de toggle para expansão de editor
   * @param {Object} config - Configuração do botão
   * @param {string} config.editorId - ID único do editor
   * @param {string} config.label - Texto do label (ex: "Código da Automação")
   * @param {string} config.icon - Ícone do Lucide (ex: "bot", "database", "code")
   * @param {HTMLElement} config.container - Container onde inserir o botão
   * @param {Function} config.onToggle - Callback para quando o botão for clicado
   * @returns {Object} - Objeto com elementos criados
   */
  static create(config) {
    const {
      editorId,
      label,
      icon,
      container,
      onToggle
    } = config;

    // Criar estrutura do header com toggle
    const headerDiv = document.createElement('div');
    headerDiv.className = 'field-header-with-toggle';

    // Criar label com ícone
    const labelElement = document.createElement('label');
    labelElement.innerHTML = `
      <i data-lucide="${icon}" class="field-icon"></i>
      ${label}
    `;

    // Criar botão de toggle
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'editor-toggle-btn-discrete';
    toggleButton.setAttribute('data-editor-toggle', editorId);
    toggleButton.title = 'Expandir editor (Ctrl+Shift+E)';
    
    toggleButton.innerHTML = `
      <span class="toggle-text">expandir</span>
      <span class="toggle-icon">⤢</span>
    `;

    // Adicionar event listener se fornecido
    if (onToggle) {
      toggleButton.addEventListener('click', onToggle);
    }

    // Montar estrutura
    headerDiv.appendChild(labelElement);
    headerDiv.appendChild(toggleButton);

    // Inserir no container
    if (container) {
      // Se já existe um h3, substituir por nossa estrutura
      const existingH3 = container.querySelector('h3');
      if (existingH3) {
        existingH3.parentNode.replaceChild(headerDiv, existingH3);
      } else {
        // Inserir no início do container
        container.insertBefore(headerDiv, container.firstChild);
      }
    }

    return {
      headerDiv,
      labelElement,
      toggleButton
    };
  }

  /**
   * Cria um botão inline (dentro do label) para casos específicos
   * @param {Object} config - Configuração do botão inline
   * @returns {Object} - Objeto com elementos criados
   */
  static createInline(config) {
    const {
      editorId,
      label,
      icon,
      container,
      onToggle
    } = config;

    // Criar estrutura inline (como o sessionData atual)
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'field';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'field-header-with-toggle';

    const labelElement = document.createElement('label');
    labelElement.innerHTML = `
      <i data-lucide="${icon}" class="field-icon"></i>
      ${label}
    `;

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'editor-toggle-btn-discrete';
    toggleButton.setAttribute('data-editor-toggle', editorId);
    toggleButton.title = 'Expandir editor (Ctrl+Shift+E)';
    
    toggleButton.innerHTML = `
      <span class="toggle-text">expandir</span>
      <span class="toggle-icon">⤢</span>
    `;

    if (onToggle) {
      toggleButton.addEventListener('click', onToggle);
    }

    headerDiv.appendChild(labelElement);
    headerDiv.appendChild(toggleButton);
    fieldDiv.appendChild(headerDiv);

    if (container) {
      container.appendChild(fieldDiv);
    }

    return {
      fieldDiv,
      headerDiv,
      labelElement,
      toggleButton
    };
  }

  /**
   * Atualiza um botão existente para o estado especificado
   * @param {HTMLElement} button - Elemento do botão
   * @param {boolean} isExpanded - Se está expandido
   */
  static updateButtonState(button, isExpanded) {
    const textSpan = button.querySelector('.toggle-text');
    
    if (isExpanded) {
      button.classList.add('expanded');
      if (textSpan) textSpan.textContent = 'recolher';
      button.title = 'Recolher editor (ESC ou Ctrl+Shift+E)';
    } else {
      button.classList.remove('expanded');
      if (textSpan) textSpan.textContent = 'expandir';
      button.title = 'Expandir editor (Ctrl+Shift+E)';
    }
  }

  /**
   * Remove um botão de toggle e restaura o layout original
   * @param {HTMLElement} button - Botão a ser removido
   */
  static remove(button) {
    const headerDiv = button.closest('.field-header-with-toggle');
    if (headerDiv) {
      const label = headerDiv.querySelector('label');
      if (label) {
        // Converter de volta para h3 se necessário
        const h3 = document.createElement('h3');
        h3.innerHTML = label.innerHTML;
        h3.className = 'subsection-icon';
        headerDiv.parentNode.replaceChild(h3, headerDiv);
      } else {
        headerDiv.remove();
      }
    }
  }

  /**
   * Encontra todos os botões de toggle na página
   * @returns {NodeList} - Lista de botões encontrados
   */
  static findAllToggleButtons() {
    return document.querySelectorAll('.editor-toggle-btn-discrete');
  }

  /**
   * Encontra um botão específico pelo ID do editor
   * @param {string} editorId - ID do editor
   * @returns {HTMLElement|null} - Botão encontrado ou null
   */
  static findButtonByEditorId(editorId) {
    return document.querySelector(`[data-editor-toggle="${editorId}"]`);
  }
}
