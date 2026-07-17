import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'sdk/**', 'docs/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Vite resolves root-absolute paths (e.g. "/vite.svg") against
      // public/ at build time; there's no module for the resolver to find.
      'import/no-unresolved': ['error', { ignore: ['^/'] }],
      // TypeScript already checks these; the base ESLint rules produce
      // false positives on ambient globals and overload signatures.
      'no-undef': 'off',
      'no-dupe-class-members': 'off',
      // Reverse-engineering an untyped wire protocol leans on `any` a lot;
      // track it as debt instead of blocking `pnpm lint`.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: true,
      },
    },
  },
  {
    // Hand-written ambient shim for socket.io-client@0.8.7, which ships no
    // types of its own — the legacy API is inherently loosely typed here.
    files: ['src/types/socket.io-client.d.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },
  {
    // ASB status bits faithfully mirror Epson's protocol, which reuses the
    // same bit for two different meanings (e.g. drawer-kick / battery-offline).
    files: ['src/printer/utils/statusManager.ts'],
    rules: {
      '@typescript-eslint/no-duplicate-enum-values': 'off',
    },
  },
  {
    // A deliberately faithful, line-for-line port of a public-domain
    // arbitrary-precision integer library (used for the Diffie-Hellman
    // handshake). It leans on legacy patterns (empty loop bodies used for
    // their condition/increment, module-scope scratch buffers, @ts-ignore
    // on intentionally-unsafe globals) that are correct as written. Given
    // socket-level crypto correctness against real hardware is still an
    // open question (see README "Known limitations"), this file is
    // intentionally left as close to the original as possible rather than
    // "cleaned up" without a way to verify the math still holds.
    files: ['src/crypto/bigint.ts'],
    rules: {
      'no-empty': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
];
