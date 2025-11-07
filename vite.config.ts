import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@browser': path.resolve(__dirname, './src/browser'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@frontend': path.resolve(__dirname, './src/frontend'),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ['@steerprotocol/langgraph-checkpoint-pglite'],
  },
})
