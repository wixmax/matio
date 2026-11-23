import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // Relative base so the build can later be loaded from a Capacitor/Android WebView.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Phaser is a large, single vendored dependency. Splitting it from game code
    // keeps rebuilds small and makes the size warning meaningful.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          return id.includes('node_modules/phaser') ? 'phaser' : undefined;
        },
      },
    },
  },
});
