import { EditorView, keymap, highlightSpecialChars, drawSelection, rectangularSelection, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { foldGutter, indentOnInput, indentUnit, bracketMatching } from '@codemirror/language'
import { linter, lintGutter } from '@codemirror/lint'

export default class EditorManager {
  constructor(app) {
    this.app = app;
    this.editors = {
      header: null,
      automation: null,
      footer: null,
      sessionData: null
    };
  }

  init() {
    this.initCodeEditors();
    this.setupCodeMirrorAutoSave();
  }

  initCodeEditors() {
    this.initSingleEditor('headerEditor', 'header', '// Configure os parâmetros acima para gerar o código automaticamente...', true);
    this.initSingleEditor('automationEditor', 'automation', '// Suas automações personalizadas aqui...');
    this.initSingleEditor('footerEditor', 'footer', `// Capturar informações finais
const finalUrl = await page.url();
const finalTitle = await page.title();

return {
  finalUrl,
  finalTitle,
}`);
    this.initSessionDataEditor();
  }

  initSessionDataEditor() {
    const textarea = document.getElementById('sessionData');
    if (!textarea) return;

    const currentValue = textarea.value || '{\n  "localStorage": {\n    "userPreferred_language": "pt-BR",\n    "currency": "BRL"\n  }\n}';
    
    const editorContainer = document.createElement('div');
    editorContainer.className = 'session-data-editor';
    editorContainer.style.cssText = 'border: 1px solid #333; border-radius: 4px; overflow: hidden;';
    
    textarea.parentNode.insertBefore(editorContainer, textarea);
    textarea.style.display = 'none';
    
    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      lintGutter(),
      this.createJsonLinter(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap
      ]),
      json(),
      oneDark,
      indentUnit.of('  '),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { fontSize: '12px', fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace" },
        '.cm-focused': { outline: 'none' },
        '.cm-editor': { height: 'auto' },
        '.cm-scroller': { fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace" }
      }),
      EditorView.domEventHandlers({
        blur: (event, view) => {
          setTimeout(() => this.formatJsonInEditor(view), 50);
          return false;
        }
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          textarea.value = update.state.doc.toString();
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          
          let totalInserted = 0;
          update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
            totalInserted += inserted.length;
          });
          
          const isProbablePaste = totalInserted > 20 && !update.transactions.some(tr => 
            tr.isUserEvent('input.type') || tr.isUserEvent('input.complete')
          );
          
          if (isProbablePaste) {
            setTimeout(() => this.formatJsonInEditor(update.view), 100);
          }
        }
      })
    ];

    const startState = EditorState.create({
      doc: currentValue,
      extensions: extensions
    });
    
    this.editors.sessionData = new EditorView({
      state: startState,
      parent: editorContainer
    });
  }

  setupCodeMirrorAutoSave() {
    const sessionDataTextarea = document.getElementById('sessionData');
    if (sessionDataTextarea) {
      const hasListener = sessionDataTextarea.getAttribute('data-autosave-setup');
      if (!hasListener) {
        sessionDataTextarea.addEventListener('input', () => {
          this.app.configService.saveConfig();
          this.app.generateCodeAutomatically();
        });
        sessionDataTextarea.setAttribute('data-autosave-setup', 'true');
      }
    }
  }

  createJsonLinter() {
    return linter((view) => {
      const diagnostics = [];
      const content = view.state.doc.toString();
      
      if (!content.trim()) return diagnostics;
      
      try {
        let correctedJson = content;
        const needsCorrection = correctedJson.includes('cookies:') || 
                               correctedJson.includes('localStorage:') || 
                               correctedJson.includes('sessionStorage:');
        
        if (needsCorrection) {
          correctedJson = correctedJson
            .replace(/(\s*)cookies(\s*):/g, '$1"cookies"$2:')
            .replace(/(\s*)localStorage(\s*):/g, '$1"localStorage"$2:')
            .replace(/(\s*)sessionStorage(\s*):/g, '$1"sessionStorage"$2:');
        }
        
        JSON.parse(correctedJson);
        
        if (needsCorrection) {
          diagnostics.push({
            from: 0, to: content.length, severity: 'info',
            message: '💡 JSON pode ser corrigido automaticamente. Cole novamente ou use Ctrl+Shift+F para formatar.'
          });
        }
        
      } catch (error) {
        let errorMessage = error.message;
        let errorPosition = 0;
        
        const positionMatch = errorMessage.match(/position (\d+)/);
        if (positionMatch) {
          errorPosition = parseInt(positionMatch[1]);
        }
        
        if (errorMessage.includes('Unexpected token')) {
          if (content.includes('cookies:')) errorMessage = 'Chaves devem estar entre aspas. Use "cookies" ao invés de cookies';
          else if (content.includes('localStorage:')) errorMessage = 'Chaves devem estar entre aspas. Use "localStorage" ao invés de localStorage';
          else if (content.includes('sessionStorage:')) errorMessage = 'Chaves devem estar entre aspas. Use "sessionStorage" ao invés de sessionStorage';
        }
        
        diagnostics.push({
          from: Math.max(0, errorPosition - 1),
          to: Math.min(content.length, errorPosition + 10),
          severity: 'error',
          message: `❌ JSON inválido: ${errorMessage}`
        });
      }
      
      return diagnostics;
    });
  }

  formatJsonInEditor(editorView) {
    try {
      const currentContent = editorView.state.doc.toString().trim();
      if (!currentContent) return;
      
      let correctedJson = currentContent;
      const needsCorrection = correctedJson.includes('cookies:') || 
                             correctedJson.includes('localStorage:') || 
                             correctedJson.includes('sessionStorage:');
      
      if (needsCorrection) {
        correctedJson = correctedJson
          .replace(/(\s*)cookies(\s*):/g, '$1"cookies"$2:')
          .replace(/(\s*)localStorage(\s*):/g, '$1"localStorage"$2:')
          .replace(/(\s*)sessionStorage(\s*):/g, '$1"sessionStorage"$2:');
      }
      
      const parsed = JSON.parse(correctedJson);
      const formatted = JSON.stringify(parsed, null, 2);
      
      if (formatted !== currentContent) {
        const transaction = editorView.state.update({
          changes: { from: 0, to: editorView.state.doc.length, insert: formatted }
        });
        editorView.dispatch(transaction);
        
        if (needsCorrection) {
          this.app.uiManager.log('🔧 JSON formatado e corrigido automaticamente', 'success');
        }
      }
    } catch (error) {
      // Ignore errors silently
    }
  }

  initSingleEditor(containerId, editorKey, placeholder, readonly = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
      ]),
      javascript({ typescript: true }),
      oneDark,
      indentUnit.of('  '),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { fontSize: '12px', fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace" },
        '.cm-focused': { outline: 'none' },
        '.cm-editor': { borderRadius: '6px' },
        '.cm-scroller': { fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace" },
        '.cm-gutters': { paddingRight: '2px', marginRight: '2px' },
        '.cm-content': { padding: '16px 16px 16px 4px', minHeight: '120px' },
        '&.cm-readonly .cm-cursor': { display: 'none' },
        '&.cm-readonly .cm-content': { cursor: 'default' }
      })
    ];

    if (!readonly) {
      extensions.push(EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          this.app.configService.saveConfig();
        }
      }));
    }

    if (readonly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    const startState = EditorState.create({
      doc: placeholder,
      extensions: extensions
    });
    
    this.editors[editorKey] = new EditorView({
      state: startState,
      parent: container
    });

    if (readonly) {
      this.editors[editorKey].dom.classList.add('cm-readonly');
    }
  }

  displayGeneratedCodeSections(codeSections) {
    if (!this.editors.header || !this.editors.automation || !this.editors.footer) {
      return;
    }
    
    if (codeSections.header) {
      const headerTransaction = this.editors.header.state.update({
        changes: { from: 0, to: this.editors.header.state.doc.length, insert: codeSections.header }
      });
      this.editors.header.dispatch(headerTransaction);
    }

    if (codeSections.automation) {
      const automationTransaction = this.editors.automation.state.update({
        changes: { from: 0, to: this.editors.automation.state.doc.length, insert: codeSections.automation }
      });
      this.editors.automation.dispatch(automationTransaction);
    }

    if (codeSections.footer) {
      const footerTransaction = this.editors.footer.state.update({
        changes: { from: 0, to: this.editors.footer.state.doc.length, insert: codeSections.footer }
      });
      this.editors.footer.dispatch(footerTransaction);
    }
  }
}
