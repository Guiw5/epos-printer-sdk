---
description: Cut a release of epos-printer-sdk (verify, publish to npm, tag, push)
---

Release this package. `$ARGUMENTS` may contain a bump type (`patch`, `minor`,
`major`) or `--dry-run`; with no arguments, the current version is released
as-is.

Run the automation rather than doing the steps by hand, so a release from the
CLI and a release through you are the same process:

```bash
pnpm release $ARGUMENTS
```

## What it does

Preflight (publishable, on `main`, clean tree, synced with origin, npm login)
→ `pnpm verify` (build, lint, library tests, demo tests) → inspect the tarball
→ optional version bump → `npm publish` → push `main` and the tag.

## Things to know before you run it

- **Publishing is irreversible.** `npm unpublish` only works within 72 hours,
  and the `name@version` pair is burned forever either way. If the user has not
  clearly asked for a real release, run `pnpm release --dry-run` first and show
  them the output.
- **npm will prompt for a 2FA code.** The script inherits the terminal so the
  prompt works, but you cannot type the code. If it blocks waiting for input,
  stop and hand the command to the user to run themselves.
- **The bump is rolled back automatically** if publishing fails, so a failed
  release never leaves a tag for a version that is not on the registry.
- **Check the CHANGELOG first.** The script stamps today's date over
  `Unreleased` for the version being released, but it will not write the entry
  itself. If there is no entry for the new version, add one before releasing.

## If it fails

Read the error rather than retrying blindly:

- `marked private` → wrong project directory, or `private` is still `true`.
- `403 ... Two-factor authentication` → the npm account needs 2FA enabled, or a
  granular token with 2FA bypass. That is an account security setting: the user
  has to do it, not you.
- `Behind origin/main` → pull first.
- Lint failures about `import/no-unresolved` → `dist/` is missing; `verify`
  builds first precisely to avoid this, so investigate rather than working
  around it.
