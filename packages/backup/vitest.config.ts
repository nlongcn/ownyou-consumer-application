import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', '__tests__/**', '**/*.d.ts', '**/*.config.*'],
    },
    alias: {
      '@ownyou/sync': new URL('./__tests__/mocks/sync.ts', import.meta.url).pathname,
      '@ownyou/shared-types': new URL('./__tests__/mocks/shared-types.ts', import.meta.url).pathname,
    },
  },
});
