import { ePOSBuilder } from "./builders/ePOSBuilder";
import { ePOSPrint } from "./builders/ePOSPrint";
import { ePosDeviceMessage } from "./components/ePosDeviceMessage";
import { ePOSDevice } from "./components/ePOSDevice";
import { ePosCrypto } from "./components/ePosCrypto";
import { CanvasPrint } from "./components/CanvasPrint";
import { EposHttpPrinter } from "./components/EposHttpPrinter";
import { Printer } from "./devices/Printer";
import { DeviceTerminal } from "./devices/DeviceTerminal";

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
  ePosCrypto,
  Printer,
  DeviceTerminal
};
export type { EposHttpPrinterOptions } from "./components/EposHttpPrinter";
export type { PrintServiceResponse } from "./builders/httpTransport";
export type { IDevice, DeviceType } from "./types";
export type { CAT } from "./devices/CAT";
export type { CashChanger } from "./devices/CashChanger";
export { decodePrinterStatus } from "./builders/printerStatus";
export type { PrinterStatus, PaperState } from "./builders/printerStatus";
export type {
  BarcodeType, Hri, Font, SymbolType, Level, Direction, LineStyle, Alignment,
} from "./types";
