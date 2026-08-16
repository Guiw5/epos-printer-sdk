import { CanvasPrint } from "./CanvasPrint";
import { ePOSBuilder } from "../builders/ePOSBuilder";
import { buildSoapEnvelope, PrintServiceError } from "../builders/httpTransport";
import type { FetchLike, PrintServiceResponse } from "../builders/httpTransport";
import { PRINT_SERVICE_ERRORS } from "../constants/connection";

export interface EposHttpPrinterOptions {
  /** Port used only to pick http vs https, never appended to request URLs. Default: 443 (https). */
  port?: number;
  /** devid query param the printer expects. Default: 'local_printer'. */
  deviceId?: string;
  /** Request timeout in ms. Default: 10000. */
  timeout?: number;
  /** Swap the transport. Pass a simulator (see `epos-printer-sdk/simulator`) */
  fetch?: FetchLike;
}

/**
 * Minimal, socket-free client for the ePOS-Print HTTP web service, the
 * transport a TM-T88V actually uses for plain printing. No ePOSDevice, no
 * createDevice(), no onreceive/onerror wiring required: connect() and
 * send()/print() resolve with the printer's response directly.
 *
 * All the builder methods (addText, addBarcode, addImage, addCut, ...) are
 * inherited from CanvasPrint/ePOSBuilder, chain them, then call send().
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

  /**
   * Confirms the printer is reachable. Throws a {@link PrintServiceError}
   * whose `code` says why it isn't: `TIMEOUT` (nothing answered in time, the
   * printer is off or the address is dead), `UNREACHABLE` (the request never
   * got out: the name doesn't resolve, the connection was refused, CORS),
   * `ERROR` (something answered, but not the ePOS service) or
   * `ERROR_PARAMETER` (the address isn't a usable URL). `message` carries the
   * same thing in Spanish, ready to show.
   *
   * Deliberately its own status query rather than `send()`: `send()` reports
   * an unreachable printer as ASB_NO_RESPONSE instead of failing, which is
   * exactly the cause this has to surface, and it would print whatever the
   * caller had already built.
   */
  async connect(): Promise<PrintServiceResponse> {
    const soap = buildSoapEnvelope(new ePOSBuilder().toString());
    const res = await this.dispatch(this.address, soap, false);
    if (res.status & this.ASB_NO_RESPONSE) {
      throw new PrintServiceError(res.status, '', PRINT_SERVICE_ERRORS.TIMEOUT, 'No se pudo conectar con la impresora (sin respuesta).');
    }
    return res;
  }
}
