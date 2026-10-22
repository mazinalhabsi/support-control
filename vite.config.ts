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
        // three.js stays in its own chunk so only the landing hero downloads it.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
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
