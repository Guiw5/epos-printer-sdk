// Lightweight entry point: HTTP-only printing (fetch + async/await), no
// socket.io-client, no ePOSDevice/createDevice, no crypto. This is what
// `epos-printer-sdk/http` resolves to, import from here (not the root
// package) when all you need is EposHttpPrinter, to keep bundlers from
// pulling in the socket transport at all.
export { EposHttpPrinter } from "./components/EposHttpPrinter";
export type { EposHttpPrinterOptions } from "./components/EposHttpPrinter";
export type { PrintServiceResponse } from "./builders/httpTransport";
export { decodePrinterStatus } from "./builders/printerStatus";
export type { PrinterStatus, PaperState } from "./builders/printerStatus";
export type {
  BarcodeType, Hri, Font, SymbolType, Level, Direction, LineStyle, Alignment,
} from "./types";
