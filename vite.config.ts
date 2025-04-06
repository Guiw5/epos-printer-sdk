/// <reference types="vitest" />
import { loadEnv } from 'vite';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index'
    }
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    env: loadEnv('test', process.cwd(), ''),
  }
});