import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0', // Permite acesso externo (necessário para devcontainer)
    port: 3000,
    strictPort: true,
    cors: true,
    proxy: {
      // Proxy para API backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  }
})
