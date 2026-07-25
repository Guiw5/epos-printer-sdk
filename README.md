# epos-printer-sdk

[![npm](https://img.shields.io/npm/v/epos-printer-sdk.svg)](https://www.npmjs.com/package/epos-printer-sdk)
[![CI](https://github.com/Guiw5/epos-printer-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Guiw5/epos-printer-sdk/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/epos-printer-sdk.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/epos-printer-sdk.svg)](https://www.typescriptlang.org/)
[![bundle](https://img.shields.io/bundlephobia/minzip/epos-printer-sdk?label=http%20entry)](https://bundlephobia.com/package/epos-printer-sdk)

**English** · [Español](./README.es.md)
**[Try it in the browser](https://guiw5.github.io/epos-printer-sdk/)**, the demo runs against a simulated printer, so no hardware is needed.


Print to Epson **TM** receipt printers from JavaScript, over plain HTTP, with
`async`/`await`, full TypeScript types, and no dependencies.

A ground-up TypeScript reimplementation of Epson's ePOS-Print protocol, built by
reverse-engineering their official SDK and verified against the official Epson
XML manuals and real **TM-T88V** hardware.

```ts
import { EposHttpPrinter } from 'epos-printer-sdk/http';

const printer = new EposHttpPrinter('192.168.1.100');

await printer
  .addText('Hello, World!\n')
  .addCut('feed')
  .send();
```

## Why this one

Epson ships the ePOS SDK as a minified, undocumented IIFE meant to be dropped
into a `<script>` tag: no modules, no types, no tree-shaking, and an entirely
callback-driven API. This package is a modern replacement.

- **Zero dependencies, ~7 KB gzipped.** `npm install epos-printer-sdk` pulls in
  nothing at all: no `lodash`, no `dayjs`, no bundled crypto, no Socket.IO,
  and `npm audit` reports 0 vulnerabilities.
- **Framework-agnostic, and it runs on the server.** Plain `fetch`, so it works
  in React, Vue, Svelte, vanilla, *and* in Node 18+ (API routes, SSR, scripts,
  queue workers). Not a React-only wrapper.
- **Promise-native.** `send()` resolves with the printer's actual response
  instead of making you wire up `onreceive`/`onerror` first.
- **Complete protocol coverage.** Text and formatting, 1D barcodes, 2D symbols
  (QR/PDF417/DataMatrix/Aztec/MaxiCode), canvas images, page-mode labels,
  status decoding, print-job tracking, cash-drawer kick.
- **Typed against the real spec.** Barcode/symbol/level unions were checked
  against the validation regexes in Epson's own bundle and the official XML
  manuals, not guessed.
- **Safe under concurrency.** Requests to the same printer are serialized
  automatically, because the hardware processes them one at a time anyway.
  Ten simultaneous jobs with a 2s timeout against a real TM-T88V: 4/10 succeed
  without this, 10/10 with it.
- **Verified, not just written.** 71 unit tests for the library and 18 for the
  demo, plus opt-in integration tests that run against a physical printer.

## Install

```bash
pnpm add epos-printer-sdk
```

```bash
yarn add epos-printer-sdk
```

```bash
npm install epos-printer-sdk
```

Requires **Node 18+** (for native `fetch`) or any modern browser.

## Quick start

```ts
import { EposHttpPrinter } from 'epos-printer-sdk/http';

// Port defaults to 443 (https). Pass { port: 80 } for plain http.
const printer = new EposHttpPrinter('192.168.1.100');

// Optional: verify the printer answers before sending a job.
await printer.connect(); // throws if unreachable

const result = await printer
  .addTextAlign('center')
  .addTextSize(2, 2)
  .addText('MY STORE\n')
  .addTextSize(1, 1)
  .addText('Thanks for your visit!\n')
  .addFeedLine(2)
  .addCut('feed')
  .send();

if (!result.success) {
  console.error('Print failed:', result.code);
}
```

`send()` resolves with:

```ts
{ success: boolean, code: string, status: number, battery: number, printjobid: string }
```

The builder buffer is consumed on every `send()`, so the same instance can be
reused for the next job without re-printing the previous one.

## Recipes

### Receipt with a total

```ts
await printer
  .addTextAlign('center')
  .addTextStyle(false, false, true)   // bold
  .addText('MY STORE\n')
  .addTextStyle(false, false, false)
  .addTextAlign('left')
  .addText('Coffee            $ 3.50\n')
  .addText('Sandwich          $ 6.00\n')
  .addText('------------------------\n')
  .addTextStyle(false, false, true)
  .addText('TOTAL             $ 9.50\n')
  .addFeedLine(2)
  .addCut('feed')
  .send();
```

### Barcode

```ts
await printer
  .addTextAlign('center')
  .addBarcode('0123456789', 'code128', 'below')
  .addFeedLine(1)
  .addCut('feed')
  .send();
```

Supported types: `upc_a`, `upc_e`, `ean13`, `jan13`, `ean8`, `jan8`, `code39`,
`itf`, `codabar`, `code93`, `code128`, `code128_auto`, `gs1_128`, and the four
`gs1_databar_*` variants.

### QR code / 2D symbols

```ts
await printer
  .addTextAlign('center')
  .addSymbol('https://example.com', 'qrcode_model_2', 'level_m', 4)
  .addFeedLine(1)
  .addCut('feed')
  .send();
```

Also supports PDF417, DataMatrix, Aztec, MaxiCode and stacked GS1 DataBar,
see [`SymbolType`](src/types.ts).

### Image from a canvas

```ts
const canvas = document.querySelector('canvas')!;

// Pass a printjobid to be able to track the job afterwards.
const jobId = `receipt-${Date.now()}`;
await printer.print(canvas, jobId);

// Large images keep printing after the request is accepted, poll to confirm.
const status = await printer.getPrintJobStatus(jobId);
```

### Label (page mode)

Page mode positions content in a fixed-size area instead of the receipt's
sequential flow:

```ts
await printer
  .addPageBegin()
  .addPageArea(0, 0, 380, 120)
  .addPageDirection('left_to_right')
  .addPagePosition(10, 30).addText('Product name')
  .addPagePosition(10, 60).addText('SKU-00042')
  .addPageRectangle(0, 0, 379, 119, 'thin')
  .addPageEnd()
  .send();
```

### Printer status

```ts
import { EposHttpPrinter, decodePrinterStatus } from 'epos-printer-sdk/http';

const res = await printer.send();           // no content queued = status query
const status = decodePrinterStatus(res.status, res.battery);

// { online: true, coverOpen: false, paper: 'ok', drawerOpen: false, battery: 0, raw: 251658262 }
if (status.paper === 'near_end') {
  console.warn('Paper is running low');
}
```

### Live status monitoring

```ts
printer.interval = 3000;
printer.onstatuschange = () => {
  console.log(decodePrinterStatus(printer.status, printer.battery));
};
printer.onpaperend = () => alert('Out of paper!');
printer.oncoveropen = () => alert('Cover is open');

printer.open();   // starts polling
printer.close();  // stops it
```

### Cash drawer

```ts
await printer.addPulse('drawer_1', 'pulse_100').send();
```

## Handling failures

A print can fail for very different reasons, and they need different responses:
retrying a job that failed because the paper ran out just wastes time, while
*not* retrying a job that hit a busy printer loses a receipt. `send()` rejects
only when the printer can't be reached; a printer that answers but refuses the
job resolves with `success: false` and a `code`.

| `code` | Meaning | What to do |
|---|---|---|
| `ERROR_DEVICE_BUSY` | Another client is printing | **Retry** with backoff, expected with several clients |
| `TooManyRequests`, `EX_SPOOLER` | Queue full | **Retry**, longer backoff |
| `JobSpooling`, `Printing` | Still working on it | Poll `getPrintJobStatus()` |
| `EPTR_REC_EMPTY` | Out of paper | Ask the operator; don't retry blindly |
| `EPTR_COVER_OPEN` | Cover open | Ask the operator |
| `EPTR_CUTTER`, `EPTR_MECHANICAL` | Jam / mechanical fault | Operator, then `recover()` |
| `EPTR_AUTOMATICAL` | Recoverable fault | Call `recover()`, then retry |
| `EPTR_UNRECOVERABLE` | Needs a power cycle | Operator |
| `SchemaError` | Malformed XML | Bug in your call, don't retry |
| `DeviceNotFound` | Wrong `deviceId` | Fix configuration |
| `RequestEntityTooLarge` | Job too big | Split it up |

A minimal retry helper for the transient cases:

```ts
const TRANSIENT = ['ERROR_DEVICE_BUSY', 'TooManyRequests', 'EX_SPOOLER'];

async function printWithRetry(job: () => Promise<PrintServiceResponse>, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await job();
      if (res.success || !TRANSIENT.includes(res.code)) return res;
    } catch (err) {
      if (i === attempts) throw err;   // unreachable printer, also transient
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** (i - 1)));
  }
  throw new Error('Printer unavailable after retries');
}
```

The [React example app](examples/react-app) implements this end to end, with a
panel that classifies every response code and offers the matching action.

## Testing without a printer

`epos-printer-sdk/simulator` is a simulated printer you can hand to
`EposHttpPrinter`. It speaks the real protocol, so code written against it
behaves the same against hardware, and it models paper, cover and drawer state
so failure paths can be exercised on purpose.

```ts
import { EposHttpPrinter } from 'epos-printer-sdk/http';
import { createSimulator } from 'epos-printer-sdk/simulator';

const sim = createSimulator({ initialState: { paper: 2 } });
const printer = new EposHttpPrinter('demo', { fetch: sim.fetch });

await printer.addText('hello
').addCut('feed').send();
sim.jobs[0].text;            // 'hello
'

sim.state.coverOpen = true;  // the next print fails with EPTR_COVER_OPEN
```

It is a separate entry point, so none of it reaches consumers who don't import
it. The [live demo](https://guiw5.github.io/epos-printer-sdk/) runs entirely on
it, which is why it needs no printer on the network.

## API

### `new EposHttpPrinter(host, options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `port` | `number` | `443` | `80`/`8008` switch the scheme to `http` |
| `deviceId` | `string` | `'local_printer'` | ePOS device id |
| `timeout` | `number` | `10000` | Request timeout in ms |

| Method | Returns | Description |
|---|---|---|
| `connect()` | `Promise<PrintServiceResponse>` | Health check; throws if unreachable |
| `send()` | `Promise<PrintServiceResponse>` | Sends what was built (or queries status) |
| `print(canvas, printjobid?)` | `Promise<PrintServiceResponse>` | Renders and prints a canvas |
| `getPrintJobStatus(id)` | `Promise<PrintServiceResponse>` | Status of a previous job |
| `recover()` / `reset()` | `Promise<PrintServiceResponse>` | Clear a recoverable error |
| `open()` / `close()` | `void` | Start/stop status polling |

**Builder methods** (all chainable):

- *Text*: `addText`, `addTextAlign`, `addTextSize`, `addTextDouble`,
  `addTextStyle`, `addTextFont`, `addTextLang`, `addTextLineSpace`,
  `addTextRotate`, `addTextSmooth`, `addTextPosition`, `addTextVPosition`
- *Layout*: `addFeed`, `addFeedLine`, `addFeedUnit`, `addFeedPosition`,
  `addLayout`, `addHLine`, `addVLineBegin`, `addVLineEnd`, `addRotateBegin`,
  `addRotateEnd`
- *Graphics*: `addBarcode`, `addSymbol`, `addImage`, `addLogo`
- *Page mode*: `addPageBegin`, `addPageArea`, `addPageDirection`,
  `addPagePosition`, `addPageLine`, `addPageRectangle`, `addPageEnd`
- *Device*: `addCut`, `addPulse`, `addSound`, `addRecovery`, `addReset`,
  `addCommand`

**Events** (for push-based state, still callback-style by nature):
`onstatuschange`, `onbatterystatuschange`, `ononline`, `onoffline`,
`onpoweroff`, `oncoveropen`, `oncoverok`, `onpaperend`, `onpapernearend`,
`onpaperok`, `ondraweropen`, `ondrawerclosed`, `onbatterylow`, `onbatteryok`,
`onreceive`, `onerror`.

## Bundle size

Two entry points, so HTTP-only consumers never pull in the socket transport:

| Import | Contents | Size (gzip) |
|---|---|---|
| `epos-printer-sdk/http` | `EposHttpPrinter`, `decodePrinterStatus`, types | **~7 KB** |
| `epos-printer-sdk` | Everything, incl. `ePOSDevice` + device management | ~30 KB (+31 KB `socket.io-client`, only if you install it, see below) |

The legacy `socket.io-client@0.8.7` the ePOS-Device socket transport needs is an
**optional peer dependency**: it is not installed by default, because it drags
in transitive packages with known CVEs and most printers (including every plain
TM-T88V) don't host that service anyway. Install it explicitly only if you need
the socket transport:

```bash
pnpm add socket.io-client@0.8.7
```

`sideEffects: false` plus a proper `exports` map, so Vite/webpack/Rollup/esbuild
tree-shake it without extra configuration.

## Using it with React

There is no React binding to install, the client is a plain object, so a small
hook is all you need:

```ts
function usePrinter(host: string) {
  const printer = useMemo(() => new EposHttpPrinter(host), [host]);
  return printer;
}
```

Because the HTTP transport is stateless (every job is an independent request),
there is no connection to keep alive, drop, or re-establish.

A complete example, connection UI, live status, barcodes, QR, labels, canvas
printing with job tracking, error classification with recommended actions, and
several printers at once, lives in [`examples/react-app`](examples/react-app).

## Device management (`ePOSDevice`)

Beyond plain printing, `ePOSDevice` is the session and device-management layer:
connection lifecycle, `createDevice()`, communication boxes. Despite the name it
is not tied to the socket transport, it runs over either one and picks which.
Pass `{ eposprint: true }` to go straight to HTTP; otherwise it tries the socket
and falls back to HTTP on its own.

Use it when you need devices beyond a plain printer (cash drawers, CAT
terminals, DeviceTerminal). For printing alone, `EposHttpPrinter` is lighter and
never loads any of this.

```ts
import { ePOSDevice } from 'epos-printer-sdk';

const epos = new ePOSDevice();
const result = await epos.connect('192.168.1.100', 8008);
if (result !== 'OK') throw new Error(result);

const printer = await epos.createDevice('local_printer', 'type_printer');
await printer.addText('Hi\n').addCut('feed').send();
```

Note the port rule differs from `EposHttpPrinter`: here only `8008` selects
plain HTTP, anything else (including `80`) is treated as HTTPS. That is the
vendor's own mapping, kept for parity.

Note that plain **TM-T88V** printers don't host the ePOS-Device service at all
(only TM-i, TM-DT and TM-T88VI+ models do), on those, `connect()` transparently
falls back to HTTP, which is what the official SDK does too.

## Compatibility notes

- **HTTPS and certificates.** Browsers block plain-HTTP requests from an HTTPS
  page, so production usually needs the printer reachable over HTTPS. Printers
  serve a self-signed certificate, which has to be accepted once per client
  machine, putting the printer behind a reverse proxy with a real certificate
  avoids this.
- **CORS.** Epson's `service.cgi` responds with `Access-Control-Allow-Origin: *`,
  so browser calls work without a proxy.
- **Concurrency.** The library serializes requests to the same printer
  automatically *within one process* (a browser tab, a Node process). That does
  not extend across separate clients: for those, handle `ERROR_DEVICE_BUSY`
  with retries as shown above, or funnel jobs through a server-side queue (the
  library runs on Node, so it's the same code).

## Known limitations

- Encrypted socket communication (`crypto: true`) has not been validated against
  real hardware.
- `type_display` (ePOS-Display) devices are not probed.
- 18 of the ~22 device subclasses in the original SDK (customer displays,
  keyboards, MSR readers, hybrid/slip printers, fiscal printers) are not ported, none apply to a TM-T88V.

## Docs

- [Engineering notes](docs/ENGINEERING.md), how the SDK was reverse-engineered,
  the bugs found in the original bundle, and what's verified vs. assumed.
- [Changelog](CHANGELOG.md)
- [llms.txt](llms.txt), machine-readable summary of the API and its gotchas,
  for coding assistants. Also served at
  `https://unpkg.com/epos-printer-sdk/llms.txt`.
- [AGENTS.md](AGENTS.md), conventions for agents and humans contributing here.

## Contributing

Issues and PRs welcome. The highest-value areas are broadening hardware
coverage and test depth; the WebSocket/encryption path is intentionally on hold.

## License

MIT © Guido Wagner. See [LICENSE](./LICENSE).

Not affiliated with, endorsed by, or supported by Seiko Epson Corporation.
"ePOS", "TM-T88V" and related marks belong to their respective owners.
