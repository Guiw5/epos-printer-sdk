// Decodes the raw ASB status bitmask (from PrintServiceResponse.status) into
// a plain object, the ASB_* bit values themselves live as instance
// constants on ePOSPrint/CanvasPrint/Printer (see ePOSPrint.ts), this just
// mirrors the ones consumers actually care about day to day.

const ASB_NO_RESPONSE = 1;
const ASB_DRAWER_KICK = 4;
const ASB_OFF_LINE = 8;
const ASB_COVER_OPEN = 32;
const ASB_RECEIPT_NEAR_END = 131072;
const ASB_RECEIPT_END = 524288;

export type PaperState = 'ok' | 'near_end' | 'end';

export interface PrinterStatus {
  /** false if the printer didn't respond or is off-line. */
  online: boolean;
  coverOpen: boolean;
  paper: PaperState;
  drawerOpen: boolean;
  battery: number;
  /** The raw ASB bitmask, in case you need a bit this helper doesn't decode. */
  raw: number;
}

export function decodePrinterStatus(status: number, battery: number): PrinterStatus {
  return {
    online: !(status & ASB_NO_RESPONSE) && !(status & ASB_OFF_LINE),
    coverOpen: Boolean(status & ASB_COVER_OPEN),
    paper: status & ASB_RECEIPT_END ? 'end' : status & ASB_RECEIPT_NEAR_END ? 'near_end' : 'ok',
    drawerOpen: Boolean(status & ASB_DRAWER_KICK),
    battery,
    raw: status,
  };
}
