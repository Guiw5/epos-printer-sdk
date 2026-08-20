# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the version is below `1.0.0`, breaking changes may land in minor
releases, see [Known limitations](README.md#known-limitations) for what is
still unvalidated.

## [0.6.0], 2026-08-20

A `timeout` the app asked for and the printer never saw. This goes out as a
minor rather than a patch because it adds a public export
(`TRANSPORT_MARGIN_MS`) and changes observable behavior: callers already
passing `timeout` will find that it now actually reaches the device.

### Added

- **`TRANSPORT_MARGIN_MS`**, exported from `epos-printer-sdk/http`: how much
  longer than the printer the client waits.

### Fixed

- **`timeout` now reaches the printer.** `EposHttpPrinter` pinned
  `timeout=10000` in the request URL and spent the option on the client-side
  abort only, so an app asking for 90 s still had its jobs aborted by the
  printer at 10 s — and the printer reports that as HTTP 200 with
  `success="false"` and `code="EX_TIMEOUT"`, which reads like a delivered
  request and prints nothing. Measured against a TM-T88V behind a tunnel:
  7 of 7 tickets over 100 KB died this way at 10.46–10.92 s, while 1 KB status
  queries answered in 0.09 s. `ePOSDevice`/`Printer` never had the bug
  (`Printer.ts` always interpolated `this.timeout`); it arrived with
  `EposHttpPrinter`.
- The client-side budget is now the declared one plus `TRANSPORT_MARGIN_MS`,
  so the printer's `EX_TIMEOUT` verdict arrives before the transport gives up.
  Equal budgets always expired on our side first — the two clocks start at
  different moments — turning a knowable "aborted, no paper" into an
  `AbortError` that can't be told apart from a lost answer.

## [0.5.0], 2026-08-16

0.4.0 taught the probe behind `ePOSDevice.connect()` to say *why* a connection
failed. `EposHttpPrinter`, the class the README recommends and the one apps
actually use, never got the message: it threw a bare `Error` with nothing on
it. This release gives the whole package **one** vocabulary for that answer,
reported the same way by the probe, by `ePOSDevice.connect()` and by
`PrintServiceError.code`.

### Added

- **`PrintServiceError` carries a `code`**, and is exported from both entry
  points together with `PRINT_SERVICE_ERRORS` and the `PrintServiceErrorCode`
  type, so a caller can `switch` on the cause instead of matching message
  strings: `TIMEOUT` (nothing answered before the timeout ran out),
  `UNREACHABLE` (the request never got out: a name that doesn't resolve, a
  refused connection, TLS, CORS), `ERROR` (something answered, but not the ePOS
  service) and `ERROR_PARAMETER` (the address isn't a requestable URL). All
  four come from `CONNECT_RESULTS`, not from a second list: a code means the
  same thing whichever path produced it. Measured against a real installation,
  both paths now agree: a dead address on the LAN costs the full timeout and
  reports `TIMEOUT`, a host whose name doesn't resolve fails in ~100 ms and
  reports `UNREACHABLE`, and both used to arrive as the same message.

- **`UNREACHABLE` in `CONNECT_RESULTS`.** The probe used to fold its own abort,
  a name that doesn't resolve and a refused connection into `TIMEOUT`, on the
  grounds that for the socket path they all mean "nothing here". They do not
  mean the same thing to whoever has to go and look at the printer, and the
  abort is the only way to tell them apart: the probe remembers it now, the
  same way the HTTP transport does.

### Fixed

- **`EposHttpPrinter.connect()` says why it failed.** It went through `send()`,
  which reports an unreachable printer as an `ASB_NO_RESPONSE` status instead
  of failing (that is the vendor's polling behaviour, and it stays), so the
  transport's error was already gone by the time `connect()` read the status
  and threw a bare `new Error('No se pudo conectar…')` of its own: no code, no
  HTTP status, nothing to branch on. It now issues its own status query through
  the transport and lets the classified error out.
- **The transport no longer forgets who aborted the request.** A rejected
  `fetch` looks the same whoever caused it, and a browser will say no more than
  "Failed to fetch"; the abort our own timer fires is remembered now, which is
  what separates `TIMEOUT` from `UNREACHABLE`.
- **An unusable address fails as `ERROR_PARAMETER` instead of going out.**
  `https:///cgi-bin/...`, which is what an empty printer host builds, parses
  without complaint and promotes `cgi-bin` to hostname, so the request left for
  a machine named after a path segment. The URL check `Connection` already had
  moved into the transport, one definition serving both paths.
- **`connect()` no longer sends what you have built but not sent yet.** It went
  through `send()`, which since 0.3.0 takes ownership of the builder buffer, so
  connecting after composing a job printed it.

### Changed

- **BREAKING** `PrintServiceError.message` is the cause in Spanish, ready to
  show, where it used to be `ePOS print service error (status N)`. The raw
  detail stays in `status` / `responseText`, and `name` is now
  `'PrintServiceError'`. `connect()`'s rejection is one of these instead of a
  bare `Error`, but it is still an `Error` with a Spanish `message`, so
  `catch (e) { e.message }` is unaffected.
- **BREAKING** A request to an address that isn't a requestable URL rejects
  before it reaches `fetch`. This only matters for a custom
  `EposHttpPrinterOptions.fetch` driven by something that isn't a URL; the
  simulator (`new EposHttpPrinter('demo', { fetch: sim.fetch })`) builds a real
  one and is unaffected.
- Sizes, reproduce with `pnpm size`. The classification, the messages and the
  shared vocabulary module (which the HTTP path did not import before) cost:

  | import | 0.4.0 eager | 0.5.0 eager |
  | --- | --- | --- |
  | `EposHttpPrinter` from `epos-printer-sdk/http` | 8.60 kB | 9.53 kB |
  | `ePOSDevice` from `epos-printer-sdk` | 18.51 kB | 19.12 kB |

## [0.4.0], 2026-08-16

Three things that only show up once the library is in production: a connection
failure that couldn't say what went wrong, a monitoring loop that lived on the
wrong class, and constants that existed in one form but not the other.

### Added

- **Status monitoring works on `EposHttpPrinter`, the class the README
  recommends.** `startMonitor()` / `stopMonitor()` / `updateStatus()` and the
  status query behind them lived only on `Printer`, the class
  `ePOSDevice.createDevice()` hands back. `EposHttpPrinter` declared all eleven
  status callbacks but only `open()`/`close()` could drive them, so an app that
  wanted `startMonitor()` (the vendor's name, and the one Epson's own docs use)
  had to go through `ePOSDevice` and pay for the whole device-management layer:
  18.5 kB eager instead of 8.6. The loop now lives in `ePOSPrint`, so both
  classes share one implementation, and `open()`/`close()` are aliases of the
  new pair. `Printer` keeps only what is genuinely its own: the endpoint it
  derives from the device connection, and its own status-diff sentinel.
- **The printer status bits are exported**: `ASB_NO_RESPONSE`,
  `ASB_COVER_OPEN`, `ASB_RECEIPT_END` and the rest, from both entry points, plus
  `DRAWER_OPEN_LEVEL_LOW`/`_HIGH`. They existed only as instance fields, so
  anyone decoding the `status` of a resolved response had to retype the numbers.
- **The connection constants are exported**: `CONNECT_RESULTS` (what
  `connect()` resolves with) and `CONNECTION_ERRORS`, plus `IF_*` and
  `CONNECT`/`DISCONNECT`/`RECONNECTING`. Nothing from `constants/connection`
  left the package before, which is why apps compared `connect()`'s result
  against string literals.
- **Flat `DEVICE_TYPE_*` and `ERROR_DEVICE_*` exports**, so every instance
  constant has a module twin under the same name: only `TYPES.TYPE_PRINTER`
  existed at module level, while the instance had `DEVICE_TYPE_PRINTER`.

### Fixed

- **`connect()` says why it failed.** Over the HTTP path
  (`{ eposprint: true }`) every failure came back as `ERROR_PARAMETER`: a
  printer that was switched off, a name that didn't resolve and a genuinely
  malformed address were indistinguishable, and "parameter error" is the least
  useful of the three things it could mean. The probe already knew: `fetch`
  reports abort, DNS failure and refused connection separately, and the result
  was thrown away one call up. `connect()` now resolves with `TIMEOUT` when
  nothing answered, `ERROR` when something answered but not the ePOS service,
  and keeps `ERROR_PARAMETER` for an address that isn't a usable URL (an empty
  one included, which used to go out as a request to a host named after the
  first path segment). The socket path propagates its own result the same way
  instead of flattening it.
  Note this is *not* what the vendor did on this path: its `connect()` also
  answered `OK`/`ERROR_PARAMETER` and nothing else, because `XMLHttpRequest`
  reports a dead host as `status 0`, indistinguishable from a rejected request.
  The `TIMEOUT`/`ERROR` vocabulary is the vendor's own (`ACCESS_TIMEOUT` /
  `ACCESS_ERROR`), reused here for the distinction `fetch` can actually make.
- **`printer.CUT_FEED` is no longer `undefined`.** `ALIGN_*`, `COLOR_*` and
  `MODE_*` were instance constants and `CUT_*` were not, so
  `addCut(pos.CUT_FEED)` emitted `<cut/>`, which the printer reads as
  `type="feed"`: right by accident for a receipt, and silently wrong for a label
  asking for `CUT_NO_FEED`. `CUT_*` and `FULL_CUT_*` now sit on the builder,
  like the vendor has them.
- **The monitoring poll never prints what you have built but not sent.** The
  loop used to call `send()`, which since 0.3.0 takes ownership of the builder
  buffer, so anything composed while monitoring was running could go out on the
  next tick. The poll is its own status query now, independent of the buffer.

### Changed

- **BREAKING** `connect()` resolves with `TIMEOUT` / `ERROR` where it used to
  resolve with `ERROR_PARAMETER`. Code that treats "not `OK`" as failure is
  unaffected; code that compares against `ERROR_PARAMETER` specifically has to
  compare against `CONNECT_RESULTS` instead.
- **BREAKING** The event handlers are typed. `onreceive` receives a
  `PrintServiceResponse`, `onerror` a `{ status, responseText }`,
  `onstatuschange`/`onbatterystatuschange` a `number`, and the rest take no
  arguments, instead of every one of them being `(event?: any, sq?: number)`.
  A handler that declared a parameter it never used may have to drop it.
- **BREAKING** `CAT` and `CashChanger` no longer take or hand back `any`. Their
  inputs and their result objects are declared interfaces
  (`CatTransactionParams`, `CatResult`, `CatDailyLogResult`, `CatCommandReply`,
  `CashChangerConfig`, ...), with every field optional and values typed
  `string | number`: the field *names* are in the vendor code, but the CAT
  protocol is absent from the ePOS-Device XML manual and there is no terminal
  here to check the semantics against, so anything narrower would be invented.
  Callbacks that forward the service payload untouched (`oncheckconnection`,
  `onscandata`, `ondirectio`, ...) hand out `unknown` instead of `any`, which is
  the same information without the false promise. TypeScript consumers of these
  two classes may need to narrow where they used to get `any`.
- **BREAKING** `Printer.timeoutid` is gone: the poll's timer is `intervalid`,
  shared with `ePOSPrint`. `Connection.probeWebServiceIF()` returns the probe
  result instead of the elapsed milliseconds, which nobody read.
- **`no-explicit-any` is down from 92 warnings to zero.** Beyond the two classes
  above: `Ofsc`, `CommBox`, `CommBoxManager`, `ePOSDevice` and the `msCrypto`
  fallbacks are typed, and the device-data dispatch is a declared handler table
  instead of a cast. The one `any` left, the positional wire array in
  `MessageFactory.parseRequestMessage`, is suppressed in place with the reason:
  its element types depend on the request in slot 0, so `unknown[]` would only
  move the casts around.
- Sizes moved: monitoring is in the HTTP entry now, and the status constants
  with it. Reproduce with `pnpm size`. *Eager* is the entry plus everything it
  reaches through static imports, which is what loads before any code runs:

  | import | 0.3.0 eager | 0.4.0 eager | 0.4.0 on demand |
  | --- | --- | --- | --- |
  | `EposHttpPrinter` from `epos-printer-sdk/http` | 8.00 kB | 8.60 kB | — |
  | `ePOSDevice` from `epos-printer-sdk` | 17.31 kB | 18.51 kB | 32.21 kB in 6 chunks |
  | `ePosCrypto` from `epos-printer-sdk` | 11.95 kB | 11.95 kB | — |

  The 0.60 kB the HTTP entry gains saves an app that monitors 9.91 kB, which is
  what reaching `startMonitor()` through `ePOSDevice` used to cost.

## [0.3.0], 2026-08-15

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
