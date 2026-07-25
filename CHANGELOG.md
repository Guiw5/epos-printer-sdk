# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the version is below `1.0.0`, breaking changes may land in minor
releases — see [Known limitations](README.md#known-limitations) for what is
still unvalidated.

## [0.2.0] — Unreleased

First release candidate: the HTTP printing path is validated end to end
against real TM-T88V hardware.

### Added

- **`EposHttpPrinter`** — `new`-and-go, fully Promise-based client for the
  ePOS-Print HTTP service. No `ePOSDevice`, no `createDevice()`, no callback
  wiring: `connect()` and `send()` resolve with the printer's parsed
  response.
- **`epos-printer-sdk/http` subpath export** — HTTP-only entry point that never
  pulls in `socket.io-client` or the crypto stack (~21 kB vs ~74 kB).
- **`decodePrinterStatus()`** — decodes the raw ASB bitmask into
  `{ online, coverOpen, paper, drawerOpen, battery, raw }`.
- **Promise-based device management** — `createDevice()` resolves with the
  opened device; `CommBoxManager.openCommBox()/closeCommBox()` and
  `CommBox.send()/getCommHistory()` resolve with their results and reject
  with the vendor's error codes. Legacy callbacks still fire.
- **React example app** (`examples/react-app`) — connection, monitoring,
  barcodes/QR, page-mode labels, canvas printing with job tracking, and a
  catalogue of all 21 response codes with the recommended action for each.
- **Automatic per-endpoint request serialization** — the printer processes
  HTTP requests one at a time regardless (10 concurrent status queries against
  a real TM-T88V all succeed, but the last takes ~4.9s versus ~180ms alone), so
  overlapping requests only burn their own client-side timeout while queued.
  Requests to the same endpoint now run in order; different printers still run
  in parallel. Measured against real hardware with a 2s timeout and 10
  concurrent jobs: 4/10 succeeded before, 10/10 after.
- **Test suite** — 60 unit tests plus opt-in hardware tests (skipped unless
  `PRINTER_ADDRESS` is set).

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
Epson manuals — see the [engineering notes](docs/ENGINEERING.md#bugs-found-and-fixed-during-the-port)
for the full list. Highlights:

- The full API crashed under Node: `ePOSDevice`'s constructor touched `window`,
  `Connection.probe()` used browser-only `XMLHttpRequest`, and `CookieIO` used
  `document`/`location`. All three are now guarded or ported to `fetch`, so the
  whole surface — not just the HTTP entry point — works server-side. Replacing
  the XHR also leaves the library with a single HTTP implementation instead of
  two.
- `addTextLang()` interpolated its argument into an XML attribute unescaped
  (as the vendor does) — the only place caller data could inject attributes
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
