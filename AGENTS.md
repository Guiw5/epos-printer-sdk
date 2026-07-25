# Working on this repository

Guidance for coding agents (and humans) contributing to `epos-printer-sdk`.
If you only want to *use* the library, read [README.md](README.md) or
[llms.txt](llms.txt) instead.

## Commands

This repo uses **pnpm**. The example app is a workspace package, so install
from the root.

```bash
pnpm install          # installs root + examples/*
pnpm build            # typecheck, bundle to dist/, emit .d.ts
pnpm test             # vitest (watch)
pnpm exec vitest run  # vitest (single run, what CI does)
pnpm lint             # eslint
pnpm exec tsc --noEmit  # typecheck, tests included
pnpm dev              # vanilla demo at index.html / src/main.ts
```

CI runs typecheck → lint → tests → build → `npm pack --dry-run`.

## What this project is

A ground-up TypeScript reimplementation of Epson's ePOS-Print protocol, derived
by reverse-engineering their official SDK. Two transports:

- **HTTP (ePOS-Print)** — the maintained path. `EposHttpPrinter`, stateless,
  `fetch`-based. This is what real TM-T88V hardware uses.
- **Socket (ePOS-Device)** — `ePOSDevice`, legacy Socket.IO. Deprioritized: a
  plain TM-T88V doesn't host that service at all, and its crypto handshake is
  unvalidated against real hardware.

```
src/builders/     ePOSBuilder (XML construction), ePOSPrint (HTTP send +
                  status polling), httpTransport (the single HTTP implementation)
src/components/   EposHttpPrinter, ePOSDevice, Connection, CommBox, crypto
src/devices/      Printer, CAT, CashChanger, DeviceTerminal
src/crypto/       bigint / blowfish / md5 / base64 (socket transport only)
sdk/              The original vendor bundle + official Epson manuals — the
                  source of truth this port is checked against. Not shipped.
```

## Rules that matter here

**Verify against the vendor, not intuition.** This is a port of undocumented,
minified code. Before changing protocol behavior, check it against
`sdk/epos.2.27.0.js` (the full bundle), `sdk/epos/*.js` (de-minified) and the
official manuals in `sdk/manuals/*.txt`. The manuals outrank the JS: several
"bugs" in the vendor code turned out to be correct, and one earlier "fix" here
had to be reverted after reading the actual XML spec. When the port
deliberately deviates from the vendor, say so in a comment and explain why.

**Keep it universal.** The library must run in browsers *and* Node 18+. Never
reference `window`, `document`, `location`, `XMLHttpRequest` or `DOMParser`
without a guard — all four have caused real breakage. Use `fetch`. Note that
`vitest` runs under jsdom, so it will *not* catch this class of bug; verify
Node compatibility by running against `dist/` with plain `node`.

**Don't break tree-shaking.** `epos-printer-sdk/http` must stay free of the
socket transport and crypto. `CAT`/`CashChanger` are exported as *types only*
so they stay in their own lazily-loaded chunks — exporting them as values would
pull them into the main bundle. Check `pnpm build` chunk output after touching
`src/index.ts`.

**Keep dependencies at zero.** The package installs with no dependencies and
reports 0 vulnerabilities; that is a headline feature. `socket.io-client` is an
*optional peer dependency* and must stay optional and lazily imported.

**Typing is pragmatic, not maximal.** `no-explicit-any` is a warning, not an
error. Wire-protocol payloads and legacy shims may stay loosely typed;
readability beats type-system purity here.

## Testing

Unit tests live in `__tests__` folders next to the code. Tests that need real
hardware are opt-in and self-skip unless `PRINTER_ADDRESS` is set:

```bash
PRINTER_ADDRESS=192.168.1.100 pnpm exec vitest run
```

**Hardware safety:** the printer used for development is a production device in
a working shop. Hardware tests must stay read-only or minimal-print (status
queries, one short receipt). Never add calls that change printer configuration,
NVRAM/logo storage, CAT financial operations, or DeviceTerminal
shutdown/restart.

## Documentation

`README.md` is the npm landing page: usage, examples, API. `README.es.md` is
the Spanish mirror — **keep both in sync** when changing documented behavior.
Reverse-engineering history and vendor-bug findings go in
`docs/ENGINEERING.md`, not the README. `llms.txt` is the machine-readable
summary; update its API surface list when the public API changes.
