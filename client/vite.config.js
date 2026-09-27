import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    react(),
    // Ship an ES5 fallback bundle so older mobile browsers (pre-2020 Chrome,
    // Samsung Internet, in-app WebViews) don't die on modern syntax and
    // show a blank white screen.
    legacy({
      targets: ['Chrome >= 61', 'Safari >= 11', 'Firefox >= 60', 'Android >= 61'],
      modernPolyfills: true,
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
