import type { LegacySocket } from "../types";
import { ERRORS, IF_EPOSPRINT, IF_EPOSDISPLAY, RESULTS, IF_EPOSDEVICE, IF_ALL, CONNECT } from "../constants/connection";
import { isRequestableUrl } from "../builders/httpTransport";
import type { ePosDeviceMessage } from "./ePosDeviceMessage";

export class Connection {
  // public OK: string = 'OK';
  // public SSL_CONNECT_OK: string = 'SSL_CONNECT_OK';
  // public ERROR_TIMEOUT: string = 'ERROR_TIMEOUT';
  // public ERROR_PARAMETER: string = 'ERROR_PARAMETER';
  // public ERROR_SYSTEM: string = 'SYSTEM_ERROR';
  private socket: LegacySocket | null = null;
  private address: string = '';
  private protocol: string = '';
  private port: number = 0;
  private callback: ((result: string) => void) | null = null;
  private usableIF: number = 0;
  private ws_status: number = 2;
  private dev_status: number = 2;
  // public IF_EPOSDEVICE: number = 1;
  // public IF_EPOSPRINT: number = 2;
  // public IF_EPOSDISPLAY: number = 4;
  // public IF_ALL: number = 7;
  // public ACCESS_OK: string = 'OK';
  // public ACCESS_ERROR: string = 'ERROR';
  // public ACCESS_TIMEOUT: string = 'TIMEOUT';
  // public ACCESS_NONE: string = 'NONE';
  // public CONNECT: number = 1;
  // public DISCONNECT: number = 2;
  // public RECONNECTING: number = 4;

  constructor() {}

  public getAddress(): string {
    return this.address;
  }

  /**
   * Probes one web service endpoint and reports which of the three things
   * happened: it answered (`OK`), it answered with something unusable
   * (`ERROR`), or nothing answered in time (`TIMEOUT`). An address that isn't
   * a requestable URL is `ERROR_PARAMETER`, the only failure that really is
   * about the arguments.
   *
   * Never rejects, matching the vendor SDK's callback-style probe(), which
   * always calls back with a result code regardless of outcome. Callers like
   * probeWebServiceIF() and handleSocketError() depend on that to always
   * proceed to registIFAccessResult(); a reject here left connect() hanging
   * forever whenever the probe failed (and left an unhandled rejection
   * besides).
   */
  public async probe(url: string, postdata: string): Promise<string> {
    if (!isRequestableUrl(url)) {
      return ERRORS.ERROR_PARAMETER;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 5000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'If-Modified-Since': 'Thu, 01 Jun 1970 00:00:00 GMT',
          SOAPAction: '""',
        },
        body: postdata,
        signal: controller.signal,
      });
      if (res.ok) {
        return RESULTS.OK;
      }
      console.error('probe error', res.status);
      return RESULTS.ERROR;
    } catch (e) {
      // Waiting the whole timeout and never getting out of the door are
      // different problems, and the abort above is the only way to tell them
      // apart: everything else arrives here as the same rejection.
      console.error(e);
      return timedOut ? RESULTS.TIMEOUT : RESULTS.UNREACHABLE;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Known gap vs. the vendor SDK (deferred, TM-T88V printer is the only
  // target device for this release, not ePOS-Display): the original always
  // probes both the print and display service endpoints in parallel. Here
  // the display probe is opt-in via `display`, and no caller currently
  // passes it, so isUsableDisplayIF() can never become true through this
  // path. Restore the always-both-in-parallel behavior if type_display
  // support is ever prioritized.
  //
  // Returns the print service's access result instead of the vendor's elapsed
  // time: connect() needs to know *why* the interface is unusable, and nobody
  // ever read the milliseconds.
  public async probeWebServiceIF({ display }: { display?: boolean } = {}): Promise<string> {
    if (!this.address) {
      return ERRORS.ERROR_PARAMETER;
    }

    console.log('probeWebServiceIF', this.getOrigin());

    const printUrl = `${this.getOrigin()}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
    const printData = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"></epos-print></s:Body></s:Envelope>`;
    const printResult = await this.probe(printUrl, printData);
    this.registIFAccessResult(IF_EPOSPRINT, printResult);

    if (display) {
      const displayUrl = `${this.getOrigin()}/cgi-bin/eposDisp/service.cgi?devid=local_display&timeout=10000`;
      const displayData = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-display xmlns="http://www.epson-pos.com/schemas/2012/09/epos-display"></epos-display></s:Body></s:Envelope>`;
      const displayResult = await this.probe(displayUrl, displayData);
      this.registIFAccessResult(IF_EPOSDISPLAY, displayResult);
    }

    return printResult;
  }

  public setSocket(socket: LegacySocket): void {
    this.socket = socket;
  }

  public closeSocket(): void {
    this.socket = null;
    this.setAddress("", "", 0);
  }

  public emit(eposmsg: ePosDeviceMessage): void {
    try {
      if (!this.socket) {
        return;
      }
      this.socket.emit('message', eposmsg.toTransmissionForm());
    } catch {
      throw new Error(ERRORS.ERROR_SYSTEM);
    }
  }

  public setAddress(protocol: string, address: string, port: number): void {
    this.protocol = protocol;
    this.address = address;
    this.port = port;
    this.usableIF = 0;
  }

  public getOrigin(): string {
    return `${this.protocol}://${this.address}`;
  }

  public getSocketIoURL(): string {
    return `${this.getOrigin()}:${this.port}`;
  }

  public registCallback(callback: (result: string) => void): void {
    if (typeof callback === 'function') {
      this.callback = callback;
    }
  }

  public getCallback(): ((result: string) => void) | null {
    return this.callback;
  }

  public changeStatus(target: number, status: number): void {
    switch (target) {
      case IF_ALL:
        this.dev_status = status;
        this.ws_status = status;
        break;
      case IF_EPOSDEVICE:
        this.dev_status = status;
        break;
      default:
        this.ws_status = status;
        break;
    }
  }

  public status(target: number): number {
    return target === IF_EPOSDEVICE ? this.dev_status : this.ws_status;
  }

  public isUsableDeviceIF(): boolean {
    return (this.usableIF & IF_EPOSDEVICE) === IF_EPOSDEVICE;
  }

  public isUsablePrintIF(): boolean {
    return this.isUsableDeviceIF() || (this.usableIF & IF_EPOSPRINT) === IF_EPOSPRINT;
  }

  public isUsableDisplayIF(): boolean {
    return this.isUsableDeviceIF() || (this.usableIF & IF_EPOSDISPLAY) === IF_EPOSDISPLAY;
  }

  public registIFAccessResult(type: number, code: string): void {
    if (code === RESULTS.OK) {
      this.changeStatus(type, CONNECT);
      this.usableIF |= type;
    }

    if (type === IF_EPOSDEVICE) {
      let result: string = ERRORS.ERROR_PARAMETER;
      if (this.usableIF & IF_ALL) {
        result = this.protocol === 'http' ? RESULTS.OK : RESULTS.SSL_CONNECT_OK;
      }
      if (code === ERRORS.ERROR_TIMEOUT) {
        result = ERRORS.ERROR_TIMEOUT;
      }
      try {
        if (this.callback) {
          this.callback(result);
        }
      } catch (e) {
        console.error(e);
      }
      this.callback = null;
    }
  }
}
