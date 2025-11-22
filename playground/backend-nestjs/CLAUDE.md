- Estou usando o pnpm. Não utilize comando npm neste projeto.

- Após qualquer implementação ou modificação de código, sempre execute o build para garantir que não há erros de compilação:
  ```bash
  pnpm build
  ```

- O build deve ser executado no final da implementação para validar:
  - Ausência de erros TypeScript
  - Compatibilidade entre tipos e interfaces
  - Importações e dependências corretas
  - Funcionalidade básica da aplicação

- Se o build apresentar erros, corrija-os antes de finalizar a implementação. Use os logs de erro para identificar e resolver problemas de tipagem, importação ou estrutura do código.