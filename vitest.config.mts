import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      'server-only': path.resolve(import.meta.dirname, './tests/helpers/server-only.ts'),
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
