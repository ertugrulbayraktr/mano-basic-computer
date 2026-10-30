/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from /<repo-name>/.
export default defineConfig({
  base: '/mano-basic-computer/',
  plugins: [react()],
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: { include: ['src/core/**'] },
  },
});
