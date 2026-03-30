import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (normalizedId.includes('node_modules/three/examples/jsm/')) {
            return 'three-extras';
          }

          if (normalizedId.includes('node_modules/three/')) {
            return 'three-core';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    open: true,
  },
});
