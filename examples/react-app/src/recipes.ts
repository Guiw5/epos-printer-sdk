import type { EposHttpPrinter } from 'epos-printer-sdk/http';
import { drawDemoCanvas } from './demoCanvas';

/**
 * The demo is a recipe book: every button both prints something and shows the
 * code that produced it, so the page doubles as runnable documentation.
 * `snippet` is the source as a reader should see it — kept next to `run` so
 * the two can't drift apart unnoticed.
 */
export interface Recipe {
  id: string;
  title: string;
  blurb: string;
  snippet: string;
  run: (printer: EposHttpPrinter, ctx: RecipeContext) => Promise<unknown>;
}

export interface RecipeContext {
  /** Label of the printer card, so receipts identify themselves. */
  label: string;
  barcodeData: string;
  barcodeType: Parameters<EposHttpPrinter['addBarcode']>[1];
  symbolData: string;
  symbolType: Parameters<EposHttpPrinter['addSymbol']>[1];
  onJobId?: (printjobid: string) => void;
}

export const RECIPES: Recipe[] = [
  {
    id: 'receipt',
    title: 'Sales receipt',
    blurb: 'Alignment, text size and emphasis — the everyday job.',
    snippet: `await printer
  .addTextAlign('center')
  .addTextSize(2, 2)
  .addText('MY STORE\\n')
  .addTextSize(1, 1)
  .addTextAlign('left')
  .addText('Coffee            3.50\\n')
  .addText('Sandwich          6.00\\n')
  .addText('------------------------\\n')
  .addTextStyle(false, false, true)
  .addText('TOTAL             9.50\\n')
  .addFeedLine(2)
  .addCut('feed')
  .send();`,
    run: (printer) =>
      printer
        .addTextAlign('center')
        .addTextSize(2, 2)
        .addText('MY STORE\n')
        .addTextSize(1, 1)
        .addTextAlign('left')
        .addText('Coffee            3.50\n')
        .addText('Sandwich          6.00\n')
        .addText('------------------------\n')
        .addTextStyle(false, false, true)
        .addText('TOTAL             9.50\n')
        .addFeedLine(2)
        .addCut('feed')
        .send(),
  },
  {
    id: 'barcode',
    title: '1D barcode',
    blurb: 'Any of the 17 symbologies in the ePOS-Print spec.',
    snippet: `await printer
  .addTextAlign('center')
  .addBarcode(data, type, 'below')
  .addFeedLine(1)
  .addCut('feed')
  .send();`,
    run: (printer, { barcodeData, barcodeType }) =>
      printer
        .addTextAlign('center')
        .addBarcode(barcodeData, barcodeType, 'below')
        .addFeedLine(1)
        .addCut('feed')
        .send(),
  },
  {
    id: 'symbol',
    title: 'QR / 2D symbol',
    blurb: 'QR, PDF417, DataMatrix, Aztec and stacked GS1 DataBar.',
    snippet: `await printer
  .addTextAlign('center')
  .addSymbol(data, type, 'level_m', 4)
  .addFeedLine(1)
  .addCut('feed')
  .send();`,
    run: (printer, { symbolData, symbolType }) =>
      printer
        .addTextAlign('center')
        .addSymbol(symbolData, symbolType, 'level_m', 4)
        .addFeedLine(1)
        .addCut('feed')
        .send(),
  },
  {
    id: 'label',
    title: 'Label (page mode)',
    blurb: 'Fixed-size area with positioned text — not the receipt flow.',
    snippet: `await printer
  .addPageBegin()
  .addPageArea(0, 0, 380, 120)
  .addPageDirection('left_to_right')
  .addPagePosition(10, 30).addText('Product name')
  .addPagePosition(10, 60).addText('SKU-00042')
  .addPageRectangle(0, 0, 379, 119, 'thin')
  .addPageEnd()
  .send();`,
    run: (printer, { label }) =>
      printer
        .addPageBegin()
        .addPageArea(0, 0, 380, 120)
        .addPageDirection('left_to_right')
        .addPagePosition(10, 30)
        .addText(label)
        .addPagePosition(10, 60)
        .addText('SKU-00042')
        .addPageRectangle(0, 0, 379, 119, 'thin')
        .addPageEnd()
        .send(),
  },
  {
    id: 'canvas',
    title: 'Canvas image + job tracking',
    blurb: 'Raster data is big, so the job is polled until it completes.',
    snippet: `const jobId = \`receipt-\${Date.now()}\`;
await printer.print(canvas, jobId);

// Large jobs keep printing after the request is accepted.
const status = await printer.getPrintJobStatus(jobId);`,
    run: async (printer, { onJobId }) => {
      const jobId = `canvas-${Date.now()}`;
      onJobId?.(jobId);
      const first = await printer.print(drawDemoCanvas(), jobId);
      if (first.success) return first;
      return printer.getPrintJobStatus(jobId);
    },
  },
  {
    id: 'drawer',
    title: 'Cash drawer',
    blurb: 'A pulse on the drawer-kick connector, no paper involved.',
    snippet: `await printer.addPulse('drawer_1', 'pulse_100').send();`,
    run: (printer) => printer.addPulse('drawer_1', 'pulse_100').send(),
  },
];
