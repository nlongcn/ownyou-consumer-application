import { defineConfig } from 'vitest/config'
import path from 'path'
import { config } from 'dotenv'

// Load .env file for test environment
config()

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '.worktrees/**',
      '**/*.spec.ts', // Playwright e2e tests
      '**/*.spec.tsx', // Playwright e2e tests
    ],
    env: {
      // Map environment variables to VITE_ prefixed versions for browser code
      VITE_OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      VITE_OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      VITE_ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      VITE_ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        '.worktrees/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@browser': path.resolve(__dirname, './src/browser'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@frontend': path.resolve(__dirname, './src/frontend'),
    },
  },
})
