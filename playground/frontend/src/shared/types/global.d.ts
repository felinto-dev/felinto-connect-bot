// Declara o objeto global 'lucide' para o TypeScript
declare global {
  interface Window {
    lucide: {
      createIcons: (options?: any) => void;
    };
  }
}

// Exportação vazia para garantir que o arquivo seja tratado como um módulo
export {};
