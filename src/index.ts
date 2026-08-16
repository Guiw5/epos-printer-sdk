import { ePOSBuilder } from "./builders/ePOSBuilder";
import { ePOSPrint } from "./builders/ePOSPrint";
import { ePosDeviceMessage } from "./components/ePosDeviceMessage";
import { ePOSDevice } from "./components/ePOSDevice";
import { ePosCrypto } from "./components/ePosCrypto";
import { CanvasPrint } from "./components/CanvasPrint";
import { EposHttpPrinter } from "./components/EposHttpPrinter";

export {
  // Recommended: lightweight, socket-free HTTP printing (see README).
  EposHttpPrinter,
  // Full SDK surface: device management via ePOSDevice.createDevice(),
  // socket transport, and the classes it hands back.
  ePOSBuilder,
  ePOSPrint,
  ePOSDevice,
  CanvasPrint,
  ePosDeviceMessage,
  ePosCrypto
};
// Sólo el tipo, igual que CAT y CashChanger: los entrega `createDevice()`, no se
// instancian a mano. Exportarlos como valor obligaba al barril a importarlos
// estáticos y anulaba la carga diferida del `import.meta.glob` de
// `commons/utils.ts` — entraban en el chunk de arranque aunque nadie los usara.
export type { Printer } from "./devices/Printer";
export type { DeviceTerminal } from "./devices/DeviceTerminal";
export type { EposHttpPrinterOptions } from "./components/EposHttpPrinter";
export type { PrintServiceResponse } from "./builders/httpTransport";
export { PrintServiceError } from "./builders/httpTransport";
export type { IDevice, DeviceType } from "./types";
export type { CAT } from "./devices/CAT";
export type { CashChanger } from "./devices/CashChanger";
export { decodePrinterStatus } from "./builders/printerStatus";
export type { PrinterStatus, PaperState } from "./builders/printerStatus";
export type {
  BarcodeType, Hri, Font, SymbolType, Level, Direction, LineStyle, Alignment,
} from "./types";
// Named constants for every enum-valued builder attribute (FONT_A, ALIGN_CENTER,
// CUT_FEED, HALFTONE_DITHER, ...), the printer status bits (ASB_COVER_OPEN,
// ASB_RECEIPT_END, ...) and device management (TYPES, ERRORS, DEVICE_TYPE_PRINTER,
// RESULT_OK, IFPORT_EPOSDEVICE, ...). Whatever a class carries as an instance
// constant is exported here under the same name. Tree-shakeable: importing none
// costs nothing.
export * from "./constants/eposbuilder";
export * from "./constants/devices";
export * from "./constants/status";
// Connection results, named apart because `ERRORS` is already taken by the
// device-management map: these are what `ePOSDevice.connect()` resolves with.
export {
  RESULTS as CONNECT_RESULTS,
  ERRORS as CONNECTION_ERRORS,
  PRINT_SERVICE_ERRORS,
  ERROR_SYSTEM,
  ERROR_PARAMETER,
  ERROR_TIMEOUT,
  IF_EPOSDEVICE,
  IF_EPOSPRINT,
  IF_EPOSDISPLAY,
  IF_ALL,
  CONNECT,
  DISCONNECT,
  RECONNECTING,
} from "./constants/connection";
export type { PrintServiceErrorCode } from "./constants/connection";
