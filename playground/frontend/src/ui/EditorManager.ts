import { EditorView, keymap, drawSelection, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { foldGutter, indentOnInput, indentUnit, bracketMatching } from '@codemirror/language'
import { linter, lintGutter, Diagnostic } from '@codemirror/lint'
import { EditorExpansionManager, EditorType } from '../services/EditorExpansionManager'
import { CodeMirrorEditorStrategy, SessionDataEditorStrategy } from '../services/EditorStrategies'
import { AppEditors, EditorKey } from '../types/editor';

export default class EditorManager {
  public editors: AppEditors;
  private app: any;
  private expansionManager: EditorExpansionManager;

  constructor(app: any) {
    this.app = app;
    this.editors = {
      header: undefined,
      automation: undefined,
      footer: undefined,
      sessionData: undefined
    };
    
    this.expansionManager = new EditorExpansionManager();
    this.setupExpansionStrategies();
  }

  init(): void {
    this.initCodeEditors();
    this.setupEditorExpansion();
  }

  private setupExpansionStrategies(): void {
    this.expansionManager.registerEditorStrategy('sessionData', new SessionDataEditorStrategy());
    this.expansionManager.registerEditorStrategy('automation', new CodeMirrorEditorStrategy());
    this.expansionManager.registerEditorStrategy('footer', new CodeMirrorEditorStrategy());
    this.expansionManager.registerEditorStrategy('header', new CodeMirrorEditorStrategy());
  }

  private setupEditorExpansion(): void {
    setTimeout(() => {
      this.setupEditorExpansionForEditor('sessionData');
      this.setupEditorExpansionForEditor('automation');
      this.setupEditorExpansionForEditor('footer');
      this.setupEditorExpansionForEditor('header');
    }, 100);
  }

  private setupEditorExpansionForEditor(editorType: EditorType): void {
    const container = document.querySelector<HTMLElement>(`[data-editor-id="${editorType}"]`);
    const toggleButton = document.querySelector<HTMLButtonElement>(`[data-editor-toggle="${editorType}"]`);
    
    if (!container || !toggleButton) {
      console.warn(`Elementos não encontrados para editor: ${editorType}`);
      return;
    }

    this.expansionManager.setupEditor(editorType, editorType, {
        container: container,
        toggleButton: toggleButton,
        codeMirrorInstance: this.editors[editorType as EditorKey]
    });
  }

  private initCodeEditors(): void {
    this.initSingleEditor('headerEditor', 'header', '// Código de inicialização...', true);
    this.initSingleEditor('automationEditor', 'automation', '// Automação principal...');
    this.initSingleEditor('footerEditor', 'footer', '// Extração de dados e finalização...');
    this.initSessionDataEditor();
  }

  private initSessionDataEditor(): void {
    const container = document.getElementById('sessionData');
    if (!container) return;

    container.className = 'session-data-editor';
    container.setAttribute('data-editor-id', 'sessionData');
    container.style.cssText = 'border: 1px solid #333; border-radius: 4px; overflow: hidden;';

    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      foldGutter(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      lintGutter(),
      this.createJsonLinter(),
      keymap.of([
        ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, 
        ...historyKeymap, ...completionKeymap
      ]),
      json(),
      oneDark,
      indentUnit.of('  '),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { fontSize: '12px', fontFamily: "'Monaco', monospace" },
        '.cm-focused': { outline: 'none' },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          this.app.configService.saveConfig();
          this.app.generateCodeAutomatically();
        }
      })
    ];

    this.editors.sessionData = new EditorView({
      state: EditorState.create({ doc: '{}\n', extensions }),
      parent: container
    });
  }

  private createJsonLinter() {
    return linter((view) => {
      const diagnostics: Diagnostic[] = [];
      const content = view.state.doc.toString();
      if (!content.trim()) return diagnostics;
      try {
        JSON.parse(content);
      } catch (e) {
        if (e instanceof SyntaxError) {
          const match = e.message.match(/position (\d+)/);
          const pos = match ? parseInt(match[1], 10) : 0;
          diagnostics.push({
            from: pos,
            to: pos + 1,
            severity: 'error',
            message: e.message,
          });
        }
      }
      return diagnostics;
    });
  }

  private initSingleEditor(containerId: string, editorKey: EditorKey, placeholder: string, readonly: boolean = false): void {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    const extensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        foldGutter(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        keymap.of([
            ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap,
            ...historyKeymap, ...completionKeymap
        ]),
        javascript({ typescript: true }),
        oneDark,
        indentUnit.of('  '),
        EditorView.lineWrapping,
        EditorView.theme({
            '&': { fontSize: '12px', fontFamily: "'Monaco', monospace" },
            '.cm-focused': { outline: 'none' },
        })
    ];

    if (!readonly) {
      extensions.push(EditorView.updateListener.of((update) => {
        if (update.docChanged) this.app.configService.saveConfig();
      }));
    }

    if (readonly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    this.editors[editorKey] = new EditorView({
      state: EditorState.create({ doc: placeholder, extensions }),
      parent: container
    });

    if (readonly) {
      this.editors[editorKey]!.dom.classList.add('cm-readonly');
    }
  }

  displayGeneratedCodeSections(codeSections: { [key in EditorKey]?: string }): void {
    Object.keys(codeSections).forEach(key => {
        const editorKey = key as EditorKey;
        const editor = this.editors[editorKey];
        const code = codeSections[editorKey];
        if (editor && code !== undefined) {
            editor.dispatch({
                changes: { from: 0, to: editor.state.doc.length, insert: code }
            });
        }
    });
  }
}
