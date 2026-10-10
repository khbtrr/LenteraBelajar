import { defineConfig } from 'vitest/config';
import base from './vitest.config.mts';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/helpers/integration-env.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
