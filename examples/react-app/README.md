# epos-printer-sdk, React example

Minimal React app showing how to integrate `epos-printer-sdk` (the `/http` entry, see the root [README](../../README.md)) into a React app via a small `usePrinter` hook.

It depends on the library through `"epos-printer-sdk": "link:../.."`, i.e. the **real built package** (`dist/`, resolved through `package.json`'s `exports` map), not the source tree directly, this is what a real consumer's install would look like.

## Running it

```bash
# from the repo root, whenever you change the library:
pnpm build

# then, from this folder:
pnpm install
pnpm dev
```

## What's here

- [`src/usePrinter.ts`](src/usePrinter.ts), the integration point: wraps `EposHttpPrinter` in a hook exposing:
  - connection state (`idle`/`connecting`/`connected`/`error`) and `connect`/`disconnect`
  - `printText`/`getStatus`, one-shot print/status calls
  - `isMonitoring`/`status`/`startMonitoring`/`stopMonitoring`, live status polling, decoded via `decodePrinterStatus()` (online, cover, paper, drawer, battery). Uses `EposHttpPrinter`'s inherited `open()`/`close()` polling loop: no extra library code needed for this.
  - `printCanvasAndTrack`, prints a `<canvas>` (larger print data, e.g. a rendered image) and automatically polls `getPrintJobStatus()` until the job is confirmed done, instead of trusting the first response blindly.
  - `printBarcode(data, type, hri?)`, 1D barcodes. `type` is one of the 17 values in [`src/barcodeOptions.ts`](src/barcodeOptions.ts), verified against the official ePOS-Print XML manual's `<barcode>` reference (UPC-A/E, EAN/JAN 13/8, CODE39/93/128, ITF, CODABAR, GS1-128, GS1 DataBar ×4).
  - `printSymbol(data, type, level?)`, 2D symbols (QR Code, PDF417, DataMatrix, Aztec, MaxiCode, stacked GS1 DataBar). 19 types, same source of truth.
  - `printLabel(lines)`, page-mode layout: `addPageBegin()` → `addPageArea()` → `addPageDirection()` → per-line `addPagePosition()` + `addText()` → `addPageRectangle()` (border) → `addPageEnd()`. This is the *label* print mode, distinct from a normal receipt's sequential flow, position is absolute within a fixed-size area instead of "next line down".
- [`src/PrinterCard.tsx`](src/PrinterCard.tsx), all the UI for **one** printer (connect, print/status, monitoring, barcode/QR, canvas+job-tracking, label), fully self-contained.
- [`src/App.tsx`](src/App.tsx), **multi-printer management**: a list of `<PrinterCard>`s you can add/remove at runtime. Each card owns its own `usePrinter()` instance, independent connection, state, and log, because `EposHttpPrinter` instances don't share any global state. This is the natural way to drive several printers from one app: no registry/manager class needed in the library itself, just one component instance per printer.
- [`src/barcodeOptions.ts`](src/barcodeOptions.ts), the verified `BarcodeType`/`SymbolType` value lists used to populate the dropdowns.
- [`src/demoCanvas.ts`](src/demoCanvas.ts), draws placeholder receipt content onto a canvas for the image-printing demo.
- [`src/useLog.ts`](src/useLog.ts), small helper for the on-screen activity log.

All of the above has been exercised against a real TM-T88V (barcode, QR, page-mode label, and two simultaneously-connected `EposHttpPrinter` instances against the same printer, to confirm independence).

## Reference used

Everything's checked against Epson's own official manuals rather than just the vendor SDK's source, see `sdk/manuals/` at the repo root (ePOS-Print XML User's Manual, ePOS-Device XML User's Manual, ePOS SDK for JavaScript overview). One real correction came out of this: the port previously added `x`/`y` attributes to `<image>` that don't exist in the actual spec, fixed, see the root README's "Bugs found and fixed" section.
