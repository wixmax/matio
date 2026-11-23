import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Content validation is pure TypeScript; no DOM is required.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
});
