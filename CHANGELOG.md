# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the version is below `1.0.0`, breaking changes may land in minor
releases, see [Known limitations](README.md#known-limitations) for what is
still unvalidated.

## [0.3.0], Unreleased

Builder API parity and a packaging pass: the pieces of the vendor surface that
were reachable in principle but not in practice, the validation gaps that let a
malformed job go out looking healthy, and a build that Create React App 4 can
actually consume.

Supersedes 0.2.2, which was tagged in the changelog but never published.

### Added

- **`getBody()` / `setBody()` on `ePOSBuilder`**: capture the accumulated body
  (the children of `<epos-print>`, not the document, `toString()` is the
  document) and replay it later, on the same instance or another one. A
  captured receipt reprints byte for byte with the `<image>` already
  serialized, so reprinting does not rasterize the canvas again.
  `Printer.setXmlString()`/`getXmlString()` stay as vendor-named aliases and
  now delegate to this pair.
- **`halftone`, `brightness` and `force` are public** on `ePOSBuilder`. They
  were `protected`, so the documented way to tune image rendering needed a
  cast. No setters: the vendor validates halftone and brightness inside
  `addImage()`, and so does this library, assignment stays unchecked on
  purpose.
- **The constants are exported from the package**: `epos-printer-sdk` now
  re-exports every builder constant (`FONT_A`, `ALIGN_CENTER`, `CUT_FEED`,
  `HALFTONE_DITHER`, ...) and the device-management ones (`TYPES`, `NAMES`,
  `ERRORS`, `RESULT_OK`, `IFPORT_EPOSDEVICE`, ...); `epos-printer-sdk/http`
  re-exports the builder ones. They existed but never left the package, so
  callers had to retype the string literals.
- **`ePOSDevice` instance constants** (`DEVICE_TYPE_PRINTER` and the other 13
  device types, `RESULT_OK`, `ERROR_*`, `IFPORT_EPOSDEVICE`,
  `IFPORT_EPOSDEVICE_S`, `CONNECT_TIMEOUT`, `RECONNECT_TIMEOUT`,
  `MAX_RECONNECT_RETRY`). The canonical vendor call
  `device.createDevice(id, device.DEVICE_TYPE_PRINTER, ...)` used to pass
  `undefined` and fail.

### Fixed

- **`force` no longer sticks to every later job.** `CanvasPrint.recover()`
  sets `force = true`, and only the socket branch of `Printer.send()` ever
  cleared it, so after one `recover()` over HTTP every subsequent job went out
  with `force="true"`. `send()` now consumes the flag along with the body, on
  both transports: it applies to the job it was set for and nothing after.
- **A print body passed where a `printjobid` belongs fails loudly.**
  `send()` tells a job from a job-status query with `/^<epos/`, so a bare body
  was classified as a `printjobid`, sent as a status query, printed nothing
  and resolved `success: true`. The id is now validated (up to 30 characters,
  `[0-9A-Za-z_-]`), which also stops markup being interpolated raw into the
  SOAP header.
- **Enum-valued builder attributes are validated**, matching the vendor's
  `getEnumAttr`. `addCut('banana')` used to emit `<cut type="banana"/>`, and a
  `<cut/>` the printer silently reads as `type="feed"` is not what a label
  layout asking for `CUT_NO_FEED` wanted. Same fix applied to the other
  attributes with the same hole: `addTextAlign`, `addTextFont`,
  `addTextStyle`, `addFeedPosition`, `addImage`, `addBarcode`, `addSymbol`,
  `addHLine`, `addVLineBegin`, `addVLineEnd`, `addPageDirection`,
  `addPageLine`, `addPageRectangle`, `addPulse`, `addSound`, `addLayout`.
  `addCut` additionally accepts the `*_fullcut` values this library's
  `CutType` already declared and the vendor's own regex did not.
- **`setBody()` rejects a whole document.** `setXmlString(printer.toString())`
  produced nested `<epos-print>` elements, which is invalid XML.

### Changed

- **BREAKING** `Printer` and `DeviceTerminal` are now type-only exports from
  the package root, matching `CAT` and `CashChanger`. They are handed back by
  `ePOSDevice.createDevice()` and were never meant to be constructed directly.
  Exporting them as values forced the root entry to import them statically,
  which defeated the `import.meta.glob` loader in `commons/utils.ts`: both
  classes shipped in the startup chunk even for consumers that never opened a
  device. Callers that imported either one as a value must go through
  `createDevice()`; the types are still exported under the same names.
- **The package now ships CommonJS as well as ESM, and resolves under
  webpack 4.** That toolchain (Create React App 4) could not consume this
  package at all: `"type": "module"` with an ESM-only build, an `exports` map
  with no `require` condition, and `esnext` output whose `?.`/`??` webpack 4's
  parser rejects outright. Every entry now has a `.cjs` build beside the `.js`
  one, `main` points at `./dist/index.cjs`, `exports` carries
  `import`/`require`/`default`, the build targets `es2019`, and `http/` and
  `simulator/` bridge folders (a `package.json` with `main`/`module`/`types`)
  make the subpaths resolvable for bundlers that ignore `exports` entirely.
  Nothing changes for ESM consumers, who keep resolving through `module` /
  `exports.import`.
- **The crypto stack is loaded on demand.** Diffie-Hellman + Blowfish + MD5 +
  bigint is the heaviest thing in the package and only the ePOS-Device socket
  transport reaches it, yet every `ePOSDevice` consumer was paying for it
  eagerly. `MessageFactory` now imports it dynamically, awaited once by
  `connectBySocketIo()` (already async, and before any socket handler is
  registered), so everything above it stays synchronous. It is also pinned to
  its own chunk: the root entry re-exports `ePosCrypto`, which makes the
  automatic splitter refuse to move it and quietly collapses the lazy import
  back into an eager one.
- **`socket.io-client` resolves to its browser build.** Its `main` points at
  the Node entry and the package declares no `browser` field, so bundlers
  followed it into `xmlhttprequest` and stubbed `fs`, `http`, `https`, `url`
  and `child_process` — code that cannot run in a browser, carried by every
  consumer of the socket transport. The build now aliases it to
  `dist/socket.io.js`, the browser bundle that ships in the same package. The
  socket chunk drops from 30.72 to 15.66 kB gzipped and five build warnings go
  with it.
- Sizes moved. Reproduce with `pnpm size`, which bundles a one-line entry per
  scenario the way an app would (rollup to shake and split, esbuild to minify)
  and gzips the result. *Eager* is the entry plus everything it reaches through
  static imports, which is what loads before any code runs:

  | import | 0.2.1 eager | 0.3.0 eager | 0.3.0 on demand |
  | --- | --- | --- | --- |
  | `EposHttpPrinter` from `epos-printer-sdk/http` | 6.93 kB | 8.00 kB | — |
  | `ePOSDevice` from `epos-printer-sdk` | 29.58 kB | **17.31 kB** | 32.31 kB in 6 chunks |
  | `ePosCrypto` from `epos-printer-sdk` | 11.78 kB | 11.95 kB | — |

  The printing path pays ~1 kB for the new validation and the `es2019`
  downlevel. The device path drops 12.27 kB up front: the crypto stack, the
  socket transport and each device class now load only when the code path that
  needs them runs. The unbundled files in `dist` grew (the http entry from
  ~21 kB to ~34 kB), because every constant is present there for a bundler to
  shake out.

## [0.2.1], 2026-07-26

Documentation, plus a release-tooling fix. 0.2.0 reached the registry before
the documentation pass finished, and published versions cannot be replaced, so
the corrected README ships here.

### Fixed

- The npm page carried the pre-edit README: no mention of
  `epos-printer-sdk/simulator` and no link to the live demo.
- `ePOSDevice` was described as "the socket transport". It is the session and
  device-management layer and runs over either transport, verified against real
  hardware over HTTP with no socket involved.
- `pnpm release` checks the registry during preflight instead of running the
  whole suite and then failing on a 403 that reads like a permissions error. It
  also no longer stamps the changelog or moves the tag before publishing, so a
  failed publish leaves the working tree untouched.

## [0.2.0], 2026-07-25

First release candidate: the HTTP printing path is validated end to end
against real TM-T88V hardware.

### Added

- **`EposHttpPrinter`**: `new`-and-go, fully Promise-based client for the
  ePOS-Print HTTP service. No `ePOSDevice`, no `createDevice()`, no callback
  wiring: `connect()` and `send()` resolve with the printer's parsed
  response.
- **`epos-printer-sdk/http` subpath export**: HTTP-only entry point that never
  pulls in `socket.io-client` or the crypto stack (~34 kB vs ~81 kB in
  `dist` as of 0.2.2, 6.65 kB vs 15.16 kB gzipped once bundled).
- **`decodePrinterStatus()`**: decodes the raw ASB bitmask into
  `{ online, coverOpen, paper, drawerOpen, battery, raw }`.
- **`epos-printer-sdk/simulator`**: a simulated printer you can hand to
  `EposHttpPrinter` through the new `fetch` option, so integrations can be
  built and tested without hardware. It speaks the real protocol (parses the
  SOAP body, answers with genuine ePOS-Print XML and ASB status words) and
  models paper, cover and drawer state, so code written against it behaves the
  same against a real printer. Separate entry point: none of it ships to
  consumers who don't import it.
- **Swappable transport**: `EposHttpPrinter` accepts a `fetch` option, for the
  simulator, a test double, or routing requests through a proxy.
- **Promise-based device management**: `createDevice()` resolves with the
  opened device; `CommBoxManager.openCommBox()/closeCommBox()` and
  `CommBox.send()/getCommHistory()` resolve with their results and reject
  with the vendor's error codes. Legacy callbacks still fire.
- **React example app** (`examples/react-app`), published as a live demo that
  runs against the simulator, so it works with no printer on the network. It
  is organised as a recipe book: each entry prints something and can reveal
  the source that produced it, every printed job renders as paper and can be
  flipped to the raw ePOS-Print XML that was sent, and all 21 response codes
  are catalogued with the recommended action for each.
- **Automatic per-endpoint request serialization**: the printer processes
  HTTP requests one at a time regardless (10 concurrent status queries against
  a real TM-T88V all succeed, but the last takes ~4.9s versus ~180ms alone), so
  overlapping requests only burn their own client-side timeout while queued.
  Requests to the same endpoint now run in order; different printers still run
  in parallel. Measured against real hardware with a 2s timeout and 10
  concurrent jobs: 4/10 succeeded before, 10/10 after.
- **Test suite**: 71 unit tests for the library and 18 for the demo, plus
  opt-in hardware tests that self-skip unless `PRINTER_ADDRESS` is set.
- **`pnpm release`**: one command for the whole release process, with the
  version bump rolled back automatically if publishing fails.

### Changed

- **`socket.io-client` is now an optional peer dependency**, not a hard
  dependency. It is only needed by the ePOS-Device socket transport, which
  plain TM-T88V printers don't host at all, and its transitive packages carry
  3 known advisories (2 critical). Installing this package now pulls in **zero
  dependencies and reports 0 vulnerabilities**; `npm install socket.io-client@0.8.7`
  explicitly if you need the socket transport. Without it, `connect()` degrades
  to HTTP instead of failing.

### Fixed

Bugs found by verifying the port against the vendor bundle and the official
Epson manuals, see the [engineering notes](docs/ENGINEERING.md#bugs-found-and-fixed-during-the-port)
for the full list. Highlights:

- The full API crashed under Node: `ePOSDevice`'s constructor touched `window`,
  `Connection.probe()` used browser-only `XMLHttpRequest`, and `CookieIO` used
  `document`/`location`. All three are now guarded or ported to `fetch`, so the
  whole surface, not just the HTTP entry point, works server-side. Replacing
  the XHR also leaves the library with a single HTTP implementation instead of
  two.
- `addTextLang()` interpolated its argument into an XML attribute unescaped
  (as the vendor does): the only place caller data could inject attributes
  into a print job.
- The builder buffer was never cleared after a send, so consecutive prints
  resent everything printed before it.
- `send()` after chaining `add*()` calls silently posted an empty print body.
- `EX_ENPC_TIMEOUT` was not mapped to `ERROR_DEVICE_BUSY` in the resolved
  value (only in the legacy callback).
- Response parsing used `DOMParser`, breaking the library under Node.
- `CODES.RESULT_OK` was `"RESULT_OK"` instead of the wire value `"OK"`,
  which would have rejected every successful socket handshake response.
- `toGrayImage()`'s dither table was truncated to 5 of 256 entries.
- `addTextPosition()` emitted an unquoted XML attribute.
- `socket.io-client` broke Vite's dev server for all consumers; it is now
  imported lazily and only when the socket transport is used.

### Known limitations

- Encrypted socket communication (`crypto: true`) is not validated against
  real hardware. A plain TM-T88V does not host the ePOS-Device service at
  all (only TM-i / TM-DT / TM-T88VI and later do), so the socket transport
  transparently falls back to HTTP on that hardware.
- `type_display` devices are not probed by `probeWebServiceIF()`.
