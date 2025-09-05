import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        recording: resolve(__dirname, 'recording.html')
      }
    },
    outDir: 'dist',
    sourcemap: true,
  },
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
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  }
})
