/// <reference types="vitest" />
import { loadEnv } from 'vite';
import { defineConfig } from 'vite';

// ePosCrypto + src/crypto/* : the DH/Blowfish/MD5/bigint stack, the heaviest
// thing in the package and reachable only from the ePOS-Device socket
// transport. Forced into its own chunk instead of left to the automatic
// splitter, which refuses to move it ("dynamically imported but also
// statically imported", the root entry re-exports ePosCrypto) and collapses
// MessageFactory's lazy import back into an eager one.
function manualChunks(id: string): string | undefined {
  const path = id.replace(/\\/g, '/');
  return /\/src\/crypto\/|\/src\/components\/ePosCrypto\.ts$/.test(path) ? 'crypto' : undefined;
}

import { createRequire } from 'node:module';

// socket.io-client 0.8.7 no declara `browser`, así que su `main` apunta al
// cliente de Node: arrastra `xmlhttprequest` y los builtins (fs, http, https,
// url, child_process), que en un navegador quedan como stubs vacíos. El
// paquete trae al lado el build de navegador; se resuelve ese.
const socketIoBrowser = createRequire(import.meta.url)
  .resolve('socket.io-client/dist/socket.io.js');

export default defineConfig({
  // This is a library build, public/ (the demo's favicon etc.) has no
  // business ending up in dist/, which is exactly what ships to npm.
  publicDir: false,
  resolve: {
    alias: { 'socket.io-client': socketIoBrowser },
  },
  build: {
    // Not esnext: webpack 4 (Create React App 4, which is what consumes this
    // package downstream) cannot parse `?.` or `??`, and fails the build with
    // a bare "Unexpected token" pointing inside node_modules.
    target: 'es2019',
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
      }
      // No `formats`: the output array below defines them, and vite ignores
      // `lib.formats` (noisily) whenever that array is present.
    },
    rollupOptions: {
      // One output block per format rather than a shared one: the CJS files
      // need the .cjs extension, chunks included. This package is
      // `"type": "module"`, so a chunk left as .js would be parsed as ESM and
      // `require()` of an entry would fail the moment it reached one.
      output: [
        {
          format: 'es',
          entryFileNames: '[name].js',
          // Shared/dynamically-imported chunks (socket.io-client, crypto, code
          // shared between the index/http entries) go in their own folder so
          // their names never collide with the entry files themselves.
          chunkFileNames: 'chunks/[name]-[hash].js',
          manualChunks
        },
        {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: 'chunks/[name]-[hash].cjs',
          exports: 'named',
          manualChunks
        }
      ]
    }
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    env: loadEnv('test', process.cwd(), ''),
    exclude: ['**/node_modules/**', '**/dist/**', 'examples/**'],
  }
});
