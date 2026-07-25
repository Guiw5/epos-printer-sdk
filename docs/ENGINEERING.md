# Engineering notes — reverse-engineering the ePOS SDK

How this library was built: what the original Epson bundle looks like inside,
how the port was verified, the bugs that surfaced along the way, and what is
still unvalidated.

For usage documentation, see the [README](../README.md).

## Why this exists

Epson ships the ePOS SDK as a single minified, undocumented IIFE file meant to be dropped into a `<script>` tag. There is no official TypeScript support, no module system, and no real documentation for large parts of its internals. This repo is an effort to:

- Reverse-engineer that bundle into readable, typed, modular TypeScript.
- Replace the legacy event/callback API with `Promise`-based methods where it's safe to do so.
- Keep the library dependency-light and tree-shakeable, instead of shipping the entire original SDK (crypto included) to every consumer.
- Document behavior that the original SDK never documented, as it's decoded.

## Architecture

```
sdk/                  Original vendor SDK — kept as the reverse-engineering source of truth
  epos.2.27.0.js       The full minified IIFE bundle, unmodified
  epos/                De-minified, un-bundled original modules, split by responsibility
    canvasprint.js      Canvas -> raster -> <image> element printing
    eposbuilder.js      Fluent XML builder for receipts/labels (text, barcodes, images, cuts...)
    eposprint.js         HTTP (ePOS-Print web service) transport + status polling
    eposdevice.js        WebSocket (ePOS-Device service) transport, connection lifecycle
    eposcrypto.js         Diffie-Hellman + Blowfish handshake used only over WebSocket
    printer.js             Printer device class (extends CanvasPrint)
    jsontransforms.js       Wire-format helpers for the socket protocol
  scripts/             Internal support libraries used by sdk/epos/*, mostly crypto & transport
    bigint.js            Arbitrary-precision integer math (needed for Diffie-Hellman)
    blowfish.js          Blowfish block cipher (CBC), used to encrypt socket payloads
    md5.js               MD5, used to derive the shared secret key
    base64.js            Base64 codec
    inflate.js            zlib inflate — decompression for gzip-encoded payloads
    crypto.js / epos.js    Original module wiring / entry glue
    socket.io.js           Legacy Socket.IO client bundled inline by Epson
  manuals/              Official Epson reference docs (downloaded from files.support.epson.com /
                        download3.ebz.epson.net) — the ground truth this port is checked against,
                        one level above the vendor JS itself. Not committed (large binaries); see below.

src/                  The TypeScript rewrite (what this package actually ships)
  components/          Core runtime: ePOSDevice, Connection, CommBox(Manager), crypto, message
                        framing, cookie-based reconnection, socket garbage collection
  builders/            ePOSBuilder / ePOSPrint — fluent receipt/label XML construction
  devices/             Device classes: Printer, CAT, CashChanger, DeviceTerminal
  crypto/              TypeScript port of bigint / blowfish / md5 / base64
  constants/           Protocol constants (request types, result/error codes, device types)
  commons/             Small shared helpers/utilities
```

The `sdk/` split (`epos/` vs `scripts/`) intentionally mirrors how the original bundle is actually organized internally once de-minified:

- **`sdk/epos/`** — everything that builds receipts/labels and sends them, either over WebSocket or HTTP.
- **`sdk/scripts/`** — internal support libraries, most of which exist *only* to support socket-level encryption (Diffie-Hellman, Blowfish, MD5, bigint math) plus compression (inflate) and the bundled legacy Socket.IO client.

`src/` doesn't copy that split 1:1 — it's organized by *runtime responsibility* instead (components / builders / devices / crypto), which is a more natural shape for a typed, tree-shakeable package.

## Transport & encryption — an important distinction

The SDK exposes **two independent transports**, and this is easy to miss when reading the original source:

1. **HTTP (ePOS-Print web service)** — a plain SOAP-over-HTTP POST to `/cgi-bin/epos/service.cgi`. **No encryption exists for this transport at all.**
2. **WebSocket (ePOS-Device service, Socket.IO)** — a persistent connection used for device management (printers, cash drawers, CAT terminals, etc.) and optional job encryption. This is the only transport where the Diffie-Hellman/Blowfish/MD5 machinery in `sdk/scripts/` and `src/crypto/` is relevant at all.

Practically: **if you don't need encrypted socket communication, you don't need most of `src/crypto/`, `ePosCrypto.ts`, or the DH/Blowfish/MD5 code paths.** A big chunk of this codebase's complexity exists purely to support that one optional mode.

## Migration progress

The original SDK is 100% callback/event based (`connect(address, port, callback)`, `onreceive`, `onstatuschange`, etc.). The goal is `async`/`await` wherever the underlying operation is genuinely one-shot, keeping plain event callbacks only where the protocol is truly push-based (status changes, incoming data). Progress so far:

- ✅ `connect()` — now returns a `Promise<string>` instead of taking a result callback.
- ✅ `probeWebServiceIF()` — promisified HTTP service probing.
- ✅ **HTTP printing path fully modernized**: `ePOSPrint.send()`, `CanvasPrint.print()/recover()/reset()`, `Printer.send()`, and the status-polling loop (`Printer.startMonitor`, `ePOSPrint.open`) now all run through a single shared `fetch`-based helper ([httpTransport.ts](../src/builders/httpTransport.ts)) instead of three separate copies of hand-rolled `XMLHttpRequest` + `onreadystatechange` state machines. This also fixed a real bug along the way — see [Bugs found and fixed](#bugs-found-and-fixed-during-the-port).
- ✅ **`send()` resolves with the actual response** (`{ success, code, status, battery, printjobid }`) instead of just `Promise<void>`, and rejects on a genuine print failure instead of only firing `onerror`. `onreceive`/`onerror`/`onstatuschange` still fire too, for anyone relying on the event style, but you no longer have to wire them up just to read a result.
- ✅ **[`EposHttpPrinter`](../src/components/EposHttpPrinter.ts)** — the lightweight HTTP-only class from the roadmap now exists as a real, exported, `new`-and-go API: no `ePOSDevice`, no `createDevice()`, no callbacks anywhere in the flow. See [Basic usage](#basic-usage-recommended-eposhttpprinter) below.
- ✅ `createDevice()` — now resolves with the opened device (`Promise<IDevice>`) and rejects with the vendor's error code on failure. The legacy `(device, code)` callback is still accepted as an optional last argument for backwards compatibility, but no longer required.
- ✅ `CommBox` / `CommBoxManager` — `openCommBox()` resolves with the `CommBox`, `closeCommBox()` resolves on OK, `CommBox.send()` resolves with the delivered-count and `getCommHistory()` with the history list; all reject with the vendor's error codes (`NOT_OPENED`, `ALREADY_OPENED`, ...). `onreceive` stays as an event callback — incoming messages are genuinely push-based.
- ⬜ Everything else — `Ofsc` and device event handlers (`onauthorizesales`, ...) on the WebSocket path are still callback/event-based, matching the original SDK. Low priority given the WebSocket transport itself is deprioritized (see above).

**Typing philosophy:** this is a reverse-engineered protocol port, not a greenfield app — types stay simple and pragmatic (`no-explicit-any` is a lint *warning*, not an error) rather than chasing maximal strictness where it wouldn't add real clarity.

## Challenges found along the way

Reverse-engineering an undocumented, minified bundle surfaces problems you don't hit when writing code from a spec:

- **`socket.io-client@0.8.7`** — an ~2013-era client, required because the real printer firmware speaks the old Engine.IO v1 handshake. Newer `socket.io-client` versions are not protocol-compatible with the hardware, so this dependency can't simply be upgraded without also changing what's running on the printer side.
- **Undocumented internal utilities operating on globals** — `inflate`/`gzip` (de)compression, the `bigint` arbitrary-precision math used for Diffie-Hellman, and the Blowfish/MD5 primitives were all written as globals with zero documentation and cryptic short variable names. Faithfully porting these required deriving intent purely from behavior and cross-referencing multiple minified call sites.
- **Encryption over sockets is not yet validated end-to-end.** The migrated crypto path has not been confirmed to interoperate with a real printer's socket-encrypted mode. It's suspected (not yet proven) that the specific protocol version / firmware pairing makes it impractical to swap the cipher for something modern (e.g. SHA-256-based key derivation) — the printer side is fixed and undocumented, so the only way to confirm compatibility is systematic A/B testing between the original SDK and this migration against real hardware. That investigation is planned but not yet done.

## Bugs found and fixed during the port

Reverse-engineering surfaces real bugs, not just style nits. Found and fixed so far:

- **`toGrayImage()`'s dither lookup table was truncated to 5 entries** instead of the original's 256 (`src/builders/utils.ts`), silently breaking gray16 image printing. Restored from `sdk/epos/eposbuilder.js`.
- **`ePOSPrint.send()` never actually sent the HTTP request.** A brace was misplaced when porting the `xhr.onreadystatechange` callback, leaving `xhr.send(soap)` nested *inside* the callback it was supposed to trigger — i.e. unreachable. This broke status polling and any direct use of `CanvasPrint`/`ePOSPrint.send()` outside of `Printer`. Fixed as part of the `fetch` rewrite.
- **The socket `'connect'` handler resolved `connect()` prematurely.** The port added a call to fire the connection-result callback as soon as the transport-level socket connected, before the real CONNECT → PUBKEY → ADMININFO handshake completes. The original SDK's handler does no such thing — it only disposes the socket garbage box. Removed, and `connect()`'s socket-path promise is now properly bridged through `registIFAccessResult()` (previously `registCallback()` was called but then commented out, leaving the promise with no way to ever resolve on the socket path).
- **Toolchain was fully broken**: `tsconfig.json`'s `types` array excluded `node`, so `NodeJS.Timeout` didn't resolve even though `@types/node` was present; `jsdom` was referenced by `vite.config.ts` but never installed, so `vitest` couldn't run a single test; `eslint.config.ts` was written in the legacy `.eslintrc` schema under a flat-config filename, so ESLint 9 couldn't load it at all. All fixed — see `pnpm lint`/`pnpm test`/`tsc --noEmit`.
- **`socket.io-client` was declared as a `devDependency`** despite being a real runtime import (`ePOSDevice.ts`) — anyone installing this as a library wouldn't have gotten it. Moved to `dependencies`.
- **`addTextPosition(x)` emitted invalid XML**: `<text x=${x} />` with no quotes around the attribute value. Verified against `sdk/epos/eposbuilder.js`'s `getUShortAttr()`, which always quotes. A second method (`addTextHPosition`, not part of the original SDK) had the correct quoted version sitting right next to it — merged into one correct `addTextPosition`.
- **`addImage()` validated `halftone`/`brightness` against the wrong numeric range** (0–255, copy-pasted from the width/height checks) instead of the protocol's real range (`halftone`: 0–2, `brightness`: 0.1–10). `brightness: 0` passed validation and produced a corrupted image (divide-by-zero in the gamma calculation) instead of throwing immediately like the original.
- **`Pattern`/`BarcodeType`/`SymbolType` TypeScript unions didn't match the protocol's real enum values**, verified against the original's validation regexes (`regexPattern`, `regexBarcode`, `regexSymbol` in `eposbuilder.js`): `Pattern` had two literally-wrong values (`'pattern_error'`/`'pattern_paper_end'` instead of `'error'`/`'paper_end'`) and was missing `'pattern_10'`; `BarcodeType` was missing 5 valid values; `SymbolType` was missing 14 of 19 (all MaxiCode, DataMatrix, Aztec, and stacked GS1 DataBar variants). These didn't affect runtime XML generation, but silently blocked well-typed TypeScript callers from using protocol features that do exist.
- **`socket.io-client@0.8.7` completely broke Vite's dev-server module loading** — esbuild's dependency pre-bundling throws deep inside the package's bundled CJS (`Cannot read properties of undefined (reading 'exports')`), and since `ePOSDevice.ts` statically imported it, the *entire library* failed to load under `pnpm dev` with no visible browser console error, even for pure HTTP usage. Only caught by actually running the demo app in a browser — `vitest` (Node module resolution) and `vite build` (Rollup) never hit it. Fixed by making the import lazy (`await import('socket.io-client')` inside `connectBySocketIo()`, only reached when the socket transport is actually used). Bonus: cut the production bundle's main entry from ~205KB to ~90KB, since socket.io-client now splits into its own chunk instead of always being bundled in.
- **Self-correction: `addImage()` did *not* need the `x`/`y` attributes it was given.** An earlier pass in this log incorrectly assumed the original SDK's discarded `x`/`y` values (validated but never written to the `<image>` tag) were a vendor bug, and "fixed" it by emitting them. After downloading Epson's official ePOS-Print XML manual (`sdk/manuals/`) and checking the real `<image>` element reference, its only valid attributes are `width`/`height`/`color`/`align`/`mode` — no `x`/`y` at all. The original SDK's behavior was correct; `x`/`y` in `addImage(context, x, y, ...)` only select the source region to read from the canvas via `getImageData()`, not an output position. Reverted.
- **`CashChanger.client_oncommandreply()`'s hex-decoding never ran in the original SDK**: `if (typeof data.command != "")` is always true (`typeof` never returns `""`), so the intended "decode hex when no command name is set" branch was dead code in the vendor bundle. The TS port's `if (!data.command)` is what the original evidently intended and is kept as-is (not reverted to the vendor's dead branch).
- **The HTTP transport's response parsing used `DOMParser`, a browser-only global** — under Node (SSR, API routes, scripts) every request failed and, worse, the status-query path masked the crash as a generic `ASB_NO_RESPONSE`. Replaced with the same regex-based attribute extraction the vendor itself uses in its service-probe path (`checkEposPrintService`), making `epos-printer-sdk/http` fully universal (browser + Node). Caught by running a real end-to-end print from a plain Node script — unit tests run under jsdom, which quietly provides `DOMParser`.
- **18 of the ~22 device/printer subclasses in the full SDK bundle have no TypeScript port** (`Display`, `Keyboard`, `MSR`, `POSKeyboard`, `Scanner`, `SimpleSerial`, `OtherPeripheral`, `GermanyFiscalElement`, `HybridPrinter(2)`, `ReceiptPrinter`, `SlipPrinter(2)`, `EndorsePrinter(2)`, `MICRReader(2)`, `ValidationPrinter`) — found by diffing every `function X(...)` constructor in `epos.2.27.0.js` against `src/devices/`. None of these apply to a TM-T88V (customer displays, keyboards, MSR readers, hybrid/slip/check/validation printers, fiscal printers — different hardware entirely), so this isn't treated as a gap for this project's scope, just documented honestly.

## Known limitations

- Encrypted socket communication (`crypto: true`) has not been confirmed working against real hardware, and isn't currently being pursued — the WebSocket transport is deprioritized in favor of HTTP (see top of this doc).
- The callback-to-Promise migration covers every request/response API (`connect`, `createDevice`, `send`, `CommBox`, ...); what remains callback-based is `Ofsc` and the genuinely push-based device events (see [Migration Progress](#migration-progress)).
- `src/printer/` is an in-progress refactor of the printer status-diffing logic and isn't wired into the public API yet.

## Roadmap

1. ~~Split out a lightweight HTTP-only layer (`fetch` + `Promise`s, no Socket.IO, no crypto) covering the ePOS-Print web service~~ — done: [`EposHttpPrinter`](../src/components/EposHttpPrinter.ts).
2. ~~Finish removing callbacks from the public API in favor of `Promise`-returning methods~~ — done: `EposHttpPrinter`/`CanvasPrint`/`ePOSPrint`/`Printer` (`send()` resolves with the actual response or throws), plus `ePOSDevice.createDevice()` and the `CommBox`/`CommBoxManager` request/response methods. Remaining callbacks are the genuinely push-based events (`onreceive`, `onstatuschange`, ...) and `Ofsc`.
3. Expand test coverage (builders, devices, crypto round-trips) and full API documentation (`pnpm doc` via TypeDoc).
4. If/when socket-level encryption becomes a priority again: validate it through systematic testing against the original SDK and real hardware (currently deprioritized).

The end goal: a modern, well-documented, tested rewrite of the ePOS SDK that's trivial to drop into a web client as an extremely lightweight library — no globals, no bundled crypto you don't need, no undocumented behavior, and simple/pragmatic TypeScript rather than over-engineered types.

## Publishing

The package is prepared to publish (metadata, `exports`/`sideEffects`/`.d.ts` output, `LICENSE`) but is **deliberately left as `"private": true`** in `package.json` — that line is the last thing to remove, right before actually running `npm publish`, so nothing goes out by accident.

The name `epos-printer-sdk` is unscoped and was free on the registry at the time of writing; `npm publish --dry-run` confirms it's still claimable without publishing anything.

One thing worth resolving first, genuinely the maintainer's call and not something settled here: **Epson's SDK license.** This is a TypeScript reimplementation built by directly reading Epson's ePOS SDK (`Copyright (C) Seiko Epson Corporation ... All rights reserved`, per the vendor bundle's own header). The published package (`dist/`) contains none of Epson's original files — only this project's own code — but the protocol/API surface itself is closely derived from their SDK. Whether that's fine to publish publicly depends on Epson's actual SDK license terms, which aren't included in the reference manuals downloaded into `sdk/manuals/` (they're typically bundled separately with the SDK zip download). Worth checking before publishing.

Note that this package is *not* affiliated with or endorsed by Seiko Epson Corporation.

Then:

```bash
npm pack --dry-run            # lists exactly what would be published, no side effects
# remove "private": true from package.json, then:
npm publish                   # prepublishOnly rebuilds dist/ automatically
```
