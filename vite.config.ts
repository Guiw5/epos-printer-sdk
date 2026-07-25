/// <reference types="vitest" />
import { loadEnv } from 'vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // This is a library build — public/ (the demo's favicon etc.) has no
  // business ending up in dist/, which is exactly what ships to npm.
  publicDir: false,
  build: {
    target: 'esnext',
    lib: {
      // Two entries so bundlers (and `exports` in package.json) can give
      // consumers of just the HTTP path a build that never touches
      // socket.io-client, ePOSDevice, or the crypto modules.
      entry: {
        index: 'src/index.ts',
        http: 'src/http.ts',
        // Simulated printer: dev/test/demo only, so it stays out of the
        // entries a real integration loads.
        simulator: 'src/simulator.ts'
      },
      formats: ['es']
    },
    rollupOptions: {
      output: {
        // Shared/dynamically-imported chunks (socket.io-client, code shared
        // between the index/http entries) go in their own folder so their
        // names never collide with the entry files themselves.
        chunkFileNames: 'chunks/[name]-[hash].js'
      }
    }
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    env: loadEnv('test', process.cwd(), ''),
  }
});