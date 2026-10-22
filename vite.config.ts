/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works on any static host (GitHub Pages, Netlify, a sub-folder…).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Separate long-lived chunks: framework code and course content change at different rates.
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          if (id.includes('/src/content/')) return 'content';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
