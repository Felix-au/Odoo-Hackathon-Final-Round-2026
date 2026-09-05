import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['tests/**/*.integration.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup/env.integration.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});