/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true }
    }
  },
  build: { outDir: 'dist' },

  // Vitest config
  test: {
    environment: 'jsdom',
    globals: true,
    css: true,
    include: ['tests/**/*.test.{ts,tsx}'], 
    setupFiles: './tests/setup.ts',
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}']
    }
  }
});
