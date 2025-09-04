import { EditorView } from '@codemirror/view';

// Mapeamento dos editores da aplicação
export interface AppEditors {
  header?: EditorView;
  automation?: EditorView;
  footer?: EditorView;
  sessionData?: EditorView;
}

// Chaves possíveis para os editores
export type EditorKey = keyof AppEditors;
