#!/usr/bin/env node
/**
 * What each import actually costs a consumer, measured instead of guessed.
 *
 *   pnpm size
 *
 * Bundles a one-line entry per scenario the way an app would (rollup for
 * tree-shaking and code splitting, esbuild to minify) and reports the gzipped
 * entry chunk. The entry chunk alone is the number that matters: it is what
 * loads before anything happens. Async chunks are listed apart, they only cost
 * something once the code path that needs them runs.
 *
 * Reads dist/, so run `pnpm build` first.
 */
import { build } from 'vite';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SCENARIOS = [
  { name: '`EposHttpPrinter` from `epos-printer-sdk/http`', code: "import { EposHttpPrinter } from 'epos-printer-sdk/http';\nexport default EposHttpPrinter;" },
  { name: '`ePOSDevice` from `epos-printer-sdk`', code: "import { ePOSDevice } from 'epos-printer-sdk';\nexport default ePOSDevice;" },
  { name: '`ePosCrypto` from `epos-printer-sdk`', code: "import { ePosCrypto } from 'epos-printer-sdk';\nexport default ePosCrypto;" },
];

const kb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`;

const tmp = mkdtempSync(join(tmpdir(), 'epos-size-'));
const rows = [];

try {
  for (const [i, scenario] of SCENARIOS.entries()) {
    const entry = join(tmp, `entry-${i}.js`);
    writeFileSync(entry, scenario.code);

    const result = await build({
      configFile: false,
      logLevel: 'silent',
      // Aliased to dist/ rather than resolved by name: measures the build that
      // is about to ship, not whatever happens to be installed.
      resolve: {
        alias: {
          'epos-printer-sdk/http': join(ROOT, 'dist/http.js'),
          'epos-printer-sdk': join(ROOT, 'dist/index.js'),
        },
      },
      build: {
        write: false,
        minify: 'esbuild',
        target: 'es2019',
        lib: { entry, formats: ['es'], fileName: 'out' },
      },
    });

    const chunks = result[0].output.filter((o) => o.type === 'chunk');
    const byName = new Map(chunks.map((c) => [c.fileName, c]));

    // Rollup leaves the entry as a re-export facade and puts the code in a
    // chunk it imports statically, so the entry chunk on its own measures
    // nothing. What loads before any code runs is the entry plus everything
    // reachable through static imports; only `dynamicImports` defer.
    const eagerNames = new Set();
    const walk = (name) => {
      if (eagerNames.has(name)) return;
      eagerNames.add(name);
      byName.get(name)?.imports.forEach(walk);
    };
    walk(chunks.find((c) => c.isEntry).fileName);

    const gz = (list) => list.reduce((sum, c) => sum + gzipSync(c.code).length, 0);
    const async = chunks.filter((c) => !eagerNames.has(c.fileName));

    rows.push({
      name: scenario.name,
      eager: gz(chunks.filter((c) => eagerNames.has(c.fileName))),
      async: gz(async),
      asyncCount: async.length,
    });
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('\n| import | eager (gzip) | on demand (gzip) |');
console.log('| --- | --- | --- |');
for (const r of rows) {
  const lazy = r.asyncCount ? `${kb(r.async)} in ${r.asyncCount} chunk${r.asyncCount > 1 ? 's' : ''}` : '—';
  console.log(`| ${r.name} | ${kb(r.eager)} | ${lazy} |`);
}
console.log();
