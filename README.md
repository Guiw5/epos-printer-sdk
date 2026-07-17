# @epos/printer

A TypeScript rewrite of Epson's **ePOS SDK** (`epos.2.27.0.js`), built by reverse-engineering the original minified IIFE bundle and re-implementing it with modern tooling and `async`/`await` in place of nested callbacks. Target hardware: Epson **TM-T88V** receipt printers.

> **Status: work in progress / reverse-engineering migration.** The public surface still mirrors the original callback/event-driven SDK in some places (mainly the WebSocket device-management path, see below). See [Migration Progress](#migration-progress) and [Known Limitations](#known-limitations) below before relying on this in production.

**Transport priority:** the **HTTP (ePOS-Print web service)** transport is the actively maintained, primary path — it's what TM-T88V printers use for straightforward printing, it needs no crypto handshake, and it's fully rewritten with `fetch` + `async`/`await` (see [httpTransport.ts](src/builders/httpTransport.ts)). The **WebSocket (ePOS-Device / Socket.IO)** transport is present for device-management features (cash drawers, CAT terminals, DeviceTerminal) but is **deprioritized** — its socket-level crypto handshake has not been validated against real hardware and isn't where active work is happening right now.

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
- ✅ **HTTP printing path fully modernized**: `ePOSPrint.send()`, `CanvasPrint.print()/recover()/reset()`, `Printer.send()`, and the status-polling loop (`Printer.startMonitor`, `ePOSPrint.open`) now all run through a single shared `fetch`-based helper ([httpTransport.ts](src/builders/httpTransport.ts)) instead of three separate copies of hand-rolled `XMLHttpRequest` + `onreadystatechange` state machines. This also fixed a real bug along the way — see [Bugs found and fixed](#bugs-found-and-fixed-during-the-port).
- 🟡 `createDevice()` — internals now use `async`/`await`, but the public contract still resolves the opened device through a `callback` parameter rather than the returned `Promise`. This is a deliberate intermediate step, not the final API.
- ⬜ Everything else — `CommBox`, `Ofsc`, device event handlers (`onreceive`, `onstatuschange`, `onauthorizesales`, ...) on the WebSocket path are still callback/event-based, matching the original SDK. Low priority for now given the WebSocket transport itself is deprioritized (see above).

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

## Known limitations

- Encrypted socket communication (`crypto: true`) has not been confirmed working against real hardware, and isn't currently being pursued — the WebSocket transport is deprioritized in favor of HTTP (see top of this doc).
- The callback-to-Promise migration is partial (see [Migration Progress](#migration-progress)), and now concentrated on the HTTP path.
- `src/printer/` is an in-progress refactor of the printer status-diffing logic and isn't wired into the public API yet.

## Roadmap

1. ~~Split out a lightweight HTTP-only layer (`fetch` + `Promise`s, no Socket.IO, no crypto) covering the ePOS-Print web service~~ — done, see [Migration Progress](#migration-progress).
2. Finish removing callbacks from the public API in favor of `Promise`-returning methods, focused on the HTTP path first.
3. Expand test coverage (builders, devices, crypto round-trips) and full API documentation (`pnpm doc` via TypeDoc).
4. If/when socket-level encryption becomes a priority again: validate it through systematic testing against the original SDK and real hardware (currently deprioritized).

The end goal: a modern, well-documented, tested rewrite of the ePOS SDK that's trivial to drop into a web client as an extremely lightweight library — no globals, no bundled crypto you don't need, no undocumented behavior, and simple/pragmatic TypeScript rather than over-engineered types.

## Getting started

```bash
pnpm install
pnpm dev          # Vite dev server
pnpm build        # tsc typecheck + library build (outputs to dist/)
pnpm test         # vitest
pnpm test:ui      # vitest with UI
pnpm lint         # eslint
pnpm doc          # generate API docs with TypeDoc
```

### Basic usage

```ts
import { ePOSDevice } from '@epos/printer';

const epos = new ePOSDevice();

// connect() is already Promise-based
const result = await epos.connect('192.168.1.100', 8008);

if (result !== 'OK') {
  throw new Error(`Could not connect: ${result}`);
}

// createDevice() is partially promisified — the opened device still
// arrives through the callback, not the returned Promise (see Migration Progress)
await epos.createDevice('local_printer', 'type_printer', { crypto: false }, (printer, code) => {
  if (!printer) {
    console.error('Could not open printer:', code);
    return;
  }

  printer
    .addTextAlign(printer.ALIGN_CENTER)
    .addTextSize(2, 2)
    .addText('Hello, World!\n')
    .addFeedLine(2)
    .addCut('feed');

  printer.send();
});
```

## Contributing

This is an active reverse-engineering effort against a TM-T88V. The highest-value areas right now are finishing the callback-to-Promise migration on the HTTP path and expanding test coverage (see [Roadmap](#roadmap)) — not the WebSocket/encryption path, which is intentionally on hold.
