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

// A version already on the registry can never be replaced: npm rejects it with
// a 403 that reads like a permissions problem. Catch it here, before the test
// suite runs and long before anything is pushed.
const targetVersion = bump ? null : pkg.version;
if (targetVersion) {
  let published = null;
  try {
    published = run('npm', ['view', `${pkg.name}@${targetVersion}`, 'version']);
  } catch {
    // Not published (404). That is the expected path.
  }
  if (published) {
    die(
      `${pkg.name}@${targetVersion} is already on the registry.`,
      'Published versions are immutable. Run `pnpm release patch` (or minor/major) to cut a new one.'
    );
  }
  ok(`${targetVersion} is not on the registry yet`);
}

// Same idea for the tag: releasing over an existing one silently moves it, or
// fails at push time after the package is already public.
const plannedTag = `v${bump ? '<bumped>' : pkg.version}`;
if (!bump) {
  const localTag = run('git', ['tag', '--list', plannedTag]);
  const remoteTag = run('git', ['ls-remote', '--tags', 'origin', plannedTag]);
  if (localTag || remoteTag) {
    die(
      `Tag ${plannedTag} already exists ${localTag && remoteTag ? 'locally and on origin' : localTag ? 'locally' : 'on origin'}.`,
      'That version was already released. Bump instead, or delete the tag if it was created by mistake.'
    );
  }
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

// ── 4. Stage the release, without committing anything ───────────────────
// Only working-tree edits happen here. Nothing is committed, tagged or pushed
// until npm has accepted the package, so a failed publish leaves the repo
// exactly as it was rather than a stamped changelog and a moved tag.

const before = { pkg: readFileSync(PKG, 'utf8'), changelog: readFileSync(CHANGELOG, 'utf8') };
const restore = () => {
  writeFileSync(PKG, before.pkg);
  writeFileSync(CHANGELOG, before.changelog);
};

if (bump && !dryRun) {
  say(`Bump version (${bump})`);
  // --no-git-tag-version: edit package.json only, we commit after publishing.
  run('npm', ['version', bump, '--no-git-tag-version']);
  ok(`now ${readPkg().version}`);
} else if (bump) {
  say(`Bump version (${bump})`);
  warn('dry run, skipping bump');
}

const version = readPkg().version;
const tag = `v${version}`;

say('Changelog');
{
  const log = readFileSync(CHANGELOG, 'utf8');
  const pending = new RegExp(`(## \\[${version}\\][^\\n]*?), Unreleased`);
  if (pending.test(log)) {
    const today = new Date().toISOString().slice(0, 10);
    if (!dryRun) writeFileSync(CHANGELOG, log.replace(pending, `$1, ${today}`));
    ok(`entry for ${version} dated ${today}`);
  } else if (log.includes(`## [${version}]`)) {
    ok(`entry for ${version} already dated`);
  } else {
    warn(`no entry for ${version}; the release notes will be empty`);
  }
}

// ── 5. Publish ──────────────────────────────────────────────────────────
// Irreversible: npm only allows unpublishing within 72h, and the
// name@version pair is burned forever either way.

say(`Publish ${readPkg().name}@${version}`);

if (dryRun) {
  restore();
  warn('dry run, nothing published, nothing committed');
  console.log(`\n${c.green('✓')} Dry run finished. Re-run without --dry-run to release.\n`);
  process.exit(0);
}

try {
  // stdio is inherited so npm can prompt for the 2FA one-time password.
  runLive('npm', ['publish']);
  ok('published');
} catch {
  restore();
  die(
    'npm publish failed. The working tree was left untouched.',
    'If it asked for 2FA: enable it at npmjs.com (Account, Two-Factor Authentication), then retry.'
  );
}

// ── 6. Record and push ──────────────────────────────────────────────────
// Past the point of no return: the package is public, so the commit and tag
// have to land even if something here needs a retry.

say('Record the release');
run('git', ['add', 'package.json', 'CHANGELOG.md']);
run('git', ['commit', '-m', `chore(release): ${tag}`]);
run('git', ['tag', tag]);
ok(`committed and tagged ${tag}`);

say('Push');
runLive('git', ['push', 'origin', 'main']);
runLive('git', ['push', 'origin', tag]);
ok(`pushed main and ${tag}`);

console.log(`\n${c.green('✓')} ${readPkg().name}@${readPkg().version} released.`);
console.log(c.dim(`  https://www.npmjs.com/package/${readPkg().name}`));
console.log(c.dim(`  https://github.com/Guiw5/epos-printer-sdk/releases/tag/${tag}\n`));
