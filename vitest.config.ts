import { defineConfig } from 'vitest/config';

// Restringe o backend a tests/: o app mobile (apps/mobile) usa Jest.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
