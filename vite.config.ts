/// <reference types="vitest" />
import { defineConfig } from 'vite';

// Relative base so the build works under https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    environmentMatchGlobs: [['tests/ui/**', 'jsdom']],
  },
});
