interface CreateConfig {
  editorId: string;
  label: string;
  icon: string;
  container: HTMLElement | null;
  onToggle?: (event: MouseEvent) => void;
}

interface CreateResult {
  headerDiv: HTMLDivElement;
  labelElement: HTMLLabelElement;
  toggleButton: HTMLButtonElement;
}

interface CreateInlineResult extends CreateResult {
  fieldDiv: HTMLDivElement;
}

export class ExpandToggleButton {
  static create(config: CreateConfig): CreateResult {
    const { editorId, label, icon, container, onToggle } = config;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'field-header-with-toggle';

    const labelElement = document.createElement('label') as HTMLLabelElement;
    labelElement.innerHTML = `<i data-lucide="${icon}" class="field-icon"></i> ${label}`;

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'editor-toggle-btn-discrete';
    toggleButton.dataset.editorToggle = editorId;
    toggleButton.title = 'Expandir editor (Ctrl+Shift+E)';
    toggleButton.innerHTML = `<span class="toggle-text">expandir</span><span class="toggle-icon">⤢</span>`;

    if (onToggle) {
      toggleButton.addEventListener('click', onToggle as EventListener);
    }

    headerDiv.appendChild(labelElement);
    headerDiv.appendChild(toggleButton);

    if (container) {
      const existingH3 = container.querySelector('h3');
      if (existingH3 && existingH3.parentNode) {
        existingH3.parentNode.replaceChild(headerDiv, existingH3);
      } else {
        container.insertBefore(headerDiv, container.firstChild);
      }
    }

    return { headerDiv, labelElement, toggleButton };
  }

  static createInline(config: CreateConfig): CreateInlineResult {
    const { container } = config;

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'field';

    const { headerDiv, labelElement, toggleButton } = this.create({ ...config, container: null });
    
    fieldDiv.appendChild(headerDiv);
    
    if (container) {
      container.appendChild(fieldDiv);
    }

    return { fieldDiv, headerDiv, labelElement, toggleButton };
  }

  static updateButtonState(button: HTMLButtonElement, isExpanded: boolean): void {
    const textSpan = button.querySelector<HTMLSpanElement>('.toggle-text');
    
    button.classList.toggle('expanded', isExpanded);
    if (textSpan) textSpan.textContent = isExpanded ? 'recolher' : 'expandir';
    button.title = isExpanded 
      ? 'Recolher editor (ESC ou Ctrl+Shift+E)' 
      : 'Expandir editor (Ctrl+Shift+E)';
  }

  static remove(button: HTMLButtonElement): void {
    const headerDiv = button.closest<HTMLDivElement>('.field-header-with-toggle');
    if (headerDiv) {
      const label = headerDiv.querySelector('label');
      if (label && headerDiv.parentNode) {
        const h3 = document.createElement('h3');
        h3.innerHTML = label.innerHTML;
        h3.className = 'subsection-icon';
        headerDiv.parentNode.replaceChild(h3, headerDiv);
      } else {
        headerDiv.remove();
      }
    }
  }

  static findAllToggleButtons(): NodeListOf<HTMLButtonElement> {
    return document.querySelectorAll('.editor-toggle-btn-discrete');
  }

  static findButtonByEditorId(editorId: string): HTMLButtonElement | null {
    return document.querySelector(`[data-editor-toggle="${editorId}"]`);
  }
}
