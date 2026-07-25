#!/usr/bin/env node
/**
 * One command to cut a release: preflight, verify, publish, tag, push.
 *
 *   pnpm release            # release the current version as-is
 *   pnpm release patch      # bump first (also: minor, major)
 *   pnpm release --dry-run  # do everything except publish and push
 *
 * The order is deliberate. Everything that can fail runs *before* the version
 * is bumped, and the bump is rolled back if publishing fails, otherwise you
 * end up with a tag and a commit for a version that isn't on the registry,
 * which is annoying to undo by hand.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(ROOT, 'package.json');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const bump = args.find((a) => ['patch', 'minor', 'major'].includes(a));

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

let step = 0;
const say = (msg) => console.log(`\n${c.bold(`[${++step}]`)} ${msg}`);
const ok = (msg) => console.log(`    ${c.green('✓')} ${msg}`);
const warn = (msg) => console.log(`    ${c.yellow('!')} ${msg}`);

function die(msg, hint) {
  console.error(`\n${c.red('✗')} ${msg}`);
  if (hint) console.error(`  ${c.dim(hint)}`);
  process.exit(1);
}

/** Runs a command, returning trimmed stdout. Throws on non-zero exit. */
function run(cmd, cmdArgs, opts = {}) {
  return execFileSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...opts,
  })?.trim();
}

/** Runs a command with the terminal attached, so prompts (npm OTP) work. */
function runLive(cmd, cmdArgs) {
  execFileSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const readPkg = () => JSON.parse(readFileSync(PKG, 'utf8'));

// ── 1. Preflight ────────────────────────────────────────────────────────
// Cheap checks first: no point running a 40s test suite to then discover the
// working tree is dirty.

say('Preflight');

const pkg = readPkg();

if (pkg.private) {
  die(
    `"${pkg.name}" is marked private, so npm will refuse to publish it.`,
    'If this is the wrong project, cd to the right one. If not, set "private": false.'
  );
}
ok(`${pkg.name}@${pkg.version} is publishable`);

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') {
  die(`On branch "${branch}", not main.`, 'Releases are cut from main.');
}

if (run('git', ['status', '--porcelain'])) {
  die('Working tree has uncommitted changes.', 'Commit or stash them first.');
}
ok('on main, working tree clean');

run('git', ['fetch', 'origin', 'main', '--quiet']);
const behind = run('git', ['rev-list', '--count', 'HEAD..origin/main']);
const ahead = run('git', ['rev-list', '--count', 'origin/main..HEAD']);
if (behind !== '0') {
  die(`Behind origin/main by ${behind} commit(s).`, 'Pull first.');
}
if (ahead !== '0') {
  warn(`${ahead} commit(s) not pushed yet, they'll go out with the release`);
} else {
  ok('in sync with origin/main');
}

try {
  ok(`npm user: ${run('npm', ['whoami'])}`);
} catch {
  die('Not logged in to npm.', 'Run: npm login');
}

// ── 2. Verify ───────────────────────────────────────────────────────────
// Build runs first inside `verify` because linting the example resolves the
// package through its exports map, which needs dist/ to exist.

say('Verify (build, lint, tests)');
runLive('pnpm', ['verify']);
ok('build, lint and tests pass');

// ── 3. Inspect the tarball ──────────────────────────────────────────────

say('Package contents');
const packed = run('npm', ['pack', '--dry-run', '--json']);
const [tarball] = JSON.parse(packed);
ok(`${tarball.files.length} files, ${(tarball.size / 1024).toFixed(1)} kB`);
if (tarball.files.some((f) => /(^|\/)(\.env|\.npmrc)$/.test(f.path))) {
  die('The tarball contains an env or npmrc file.', 'Check "files" in package.json.');
}

// ── 4. Bump ─────────────────────────────────────────────────────────────

if (bump) {
  say(`Bump version (${bump})`);
  if (dryRun) {
    warn('dry run, skipping bump');
  } else {
    // Creates the commit and the vX.Y.Z tag in one step.
    runLive('npm', ['version', bump, '-m', 'chore(release): v%s']);
    ok(`now ${readPkg().version}`);
  }
}

const version = dryRun && bump ? `${pkg.version} (unbumped, dry run)` : readPkg().version;
const tag = `v${readPkg().version}`;

// Stamp the changelog heading for this version, if it's still marked pending.
if (!dryRun) {
  const log = readFileSync(CHANGELOG, 'utf8');
  const pending = new RegExp(`(## \\[${readPkg().version}\\][^\\n]*?), Unreleased`);
  if (pending.test(log)) {
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(CHANGELOG, log.replace(pending, `$1, ${today}`));
    run('git', ['add', 'CHANGELOG.md']);
    run('git', ['commit', '--amend', '--no-edit']);
    run('git', ['tag', '-f', tag]);
    ok(`changelog dated ${today}`);
  } else if (!log.includes(`## [${readPkg().version}]`)) {
    warn(`CHANGELOG.md has no entry for ${readPkg().version}`);
  }
}

// ── 5. Publish ──────────────────────────────────────────────────────────
// Irreversible: npm only allows unpublishing within 72h, and the
// name@version pair is burned forever either way.

say(`Publish ${readPkg().name}@${version}`);

if (dryRun) {
  warn('dry run, not publishing, not pushing');
  console.log(`\n${c.green('✓')} Dry run finished. Re-run without --dry-run to release.\n`);
  process.exit(0);
}

try {
  // stdio is inherited so npm can prompt for the 2FA one-time password.
  runLive('npm', ['publish']);
  ok('published');
} catch {
  if (bump) {
    warn('publish failed, rolling back the version commit and tag');
    run('git', ['tag', '-d', tag]);
    run('git', ['reset', '--hard', 'HEAD~1']);
  }
  die(
    'npm publish failed.',
    'If it asked for 2FA: enable it at npmjs.com (Account → Two-Factor Authentication), then retry.'
  );
}

// ── 6. Push ─────────────────────────────────────────────────────────────

say('Push');
runLive('git', ['push', 'origin', 'main']);
runLive('git', ['push', 'origin', tag]);
ok(`pushed main and ${tag}`);

console.log(`\n${c.green('✓')} ${readPkg().name}@${readPkg().version} released.`);
console.log(c.dim(`  https://www.npmjs.com/package/${readPkg().name}`));
console.log(c.dim(`  https://github.com/Guiw5/epos-printer-sdk/releases/tag/${tag}\n`));
