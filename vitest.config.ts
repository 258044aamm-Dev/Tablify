import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Anything importing 'obsidian' — directly or transitively — resolves to the test mock.
    // This is what finally makes Obsidian-facing UI testable (SAD-69 trap T6): before this,
    // no test could import tableView.ts or tableMenu.ts, so the P3-08 toolbar shipped
    // without ever being rendered in a test.
    alias: {
      obsidian: fileURLToPath(new URL('./tests/__mocks__/obsidian.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
