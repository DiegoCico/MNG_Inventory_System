/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // TODO: MAKE THIS OWRK WITH THE CLOUD AS WELL
      '/trpc': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    css: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: './tests/setup.ts',
    coverage: { reporter: ['text', 'html'], include: ['src/**/*.{ts,tsx}'] },
  },
});
