import { CanvasPrint } from "./CanvasPrint";
import type { FetchLike, PrintServiceResponse } from "../builders/httpTransport";

export interface EposHttpPrinterOptions {
  /** Port used only to pick http vs https — never appended to request URLs. Default: 443 (https). */
  port?: number;
  /** devid query param the printer expects. Default: 'local_printer'. */
  deviceId?: string;
  /** Request timeout in ms. Default: 10000. */
  timeout?: number;
  /** Swap the transport. Pass a simulator (see `epos-printer-sdk/simulator`) */
  fetch?: FetchLike;
}

/**
 * Minimal, socket-free client for the ePOS-Print HTTP web service — the
 * transport a TM-T88V actually uses for plain printing. No ePOSDevice, no
 * createDevice(), no onreceive/onerror wiring required: connect() and
 * send()/print() resolve with the printer's response directly.
 *
 * All the builder methods (addText, addBarcode, addImage, addCut, ...) are
 * inherited from CanvasPrint/ePOSBuilder — chain them, then call send().
 *
 * @example
 * const printer = new EposHttpPrinter('printer.example.com');
 * await printer.connect(); // throws if unreachable
 * const result = await printer.addText('hello\n').addCut('feed').send();
 * console.log(result.success);
 */
export class EposHttpPrinter extends CanvasPrint {
  constructor(host: string, options: EposHttpPrinterOptions = {}) {
    const port = options.port ?? 443;
    const protocol = port === 80 || port === 8008 ? 'http' : 'https';
    const deviceId = options.deviceId ?? 'local_printer';
    super(`${protocol}://${host}/cgi-bin/epos/service.cgi?devid=${deviceId}&timeout=10000`);
    this.timeout = options.timeout ?? 10000;
    this.fetchImpl = options.fetch;
  }

  /** Confirms the printer is reachable. Throws if it isn't. */
  async connect(): Promise<PrintServiceResponse> {
    const res = await this.send();
    if (res.status & this.ASB_NO_RESPONSE) {
      throw new Error('No se pudo conectar con la impresora (sin respuesta).');
    }
    return res;
  }
}
