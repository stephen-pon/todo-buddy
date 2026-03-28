import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@todo-buddy/shared': resolve(__dirname, '../shared/index.ts'),
    },
  },
});
