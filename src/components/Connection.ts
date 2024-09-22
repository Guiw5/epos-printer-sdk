export class Connection {
  public OK: string = 'OK';
  public SSL_CONNECT_OK: string = 'SSL_CONNECT_OK';
  public ERROR_TIMEOUT: string = 'ERROR_TIMEOUT';
  public ERROR_PARAMETER: string = 'ERROR_PARAMETER';
  public ERROR_SYSTEM: string = 'SYSTEM_ERROR';
  private socket_p: any = null;
  private address_p: string = '';
  private protocol_p: string = '';
  private port_p: string = '';
  private callback_p: ((result: string) => void) | null = null;
  private usableIF_p: number = 0;
  private ws_status_p: number = 2;
  private dev_status_p: number = 2;
  public IF_EPOSDEVICE: number = 1;
  public IF_EPOSPRINT: number = 2;
  public IF_EPOSDISPLAY: number = 4;
  public IF_ALL: number = 7;
  public ACCESS_OK: string = 'OK';
  public ACCESS_ERROR: string = 'ERROR';
  public ACCESS_TIMEOUT: string = 'TIMEOUT';
  public ACCESS_NONE: string = 'NONE';
  public CONNECT: number = 1;
  public DISCONNECT: number = 2;
  public RECONNECTING: number = 4;

  constructor() {}

  public async probe(url: string, postdata: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let xhr: XMLHttpRequest | null = null;
      let tid: ReturnType<typeof setTimeout>;

      try {
        xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'text/xml; charset=utf-8');
        xhr.setRequestHeader('If-Modified-Since', 'Thu, 01 Jun 1970 00:00:00 GMT');
        xhr.setRequestHeader('SOAPAction', '""');
        xhr.onreadystatechange = () => {
          if (xhr!.readyState === 4) {
            clearTimeout(tid);
            if (xhr!.status === 200) {
              resolve(this.OK);
            } else {
              resolve(this.ERROR_PARAMETER);
            }
          }
        };
        tid = setTimeout(() => {
          xhr?.abort();
          resolve(this.ERROR_TIMEOUT);
        }, 5000);
        xhr.timeout = 10000;
        xhr.send(postdata);
      } catch (e) {
        reject(this.ERROR_PARAMETER);
      }
      
    });
  }

  public async probeWebServiceIF(): Promise<number> {
    const startTime = Date.now();
    const printUrl = `${this.getAddressWithProtocol()}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
    const printData = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"></epos-print></s:Body></s:Envelope>`;
    const displayUrl = `${this.getAddressWithProtocol()}/cgi-bin/eposDisp/service.cgi?devid=local_display&timeout=10000`;
    const displayData = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-display xmlns="http://www.epson-pos.com/schemas/2012/09/epos-display"></epos-display></s:Body></s:Envelope>`;

    const printResult = await this.probe(printUrl, printData);
    this.registIFAccessResult(this.IF_EPOSPRINT, printResult === this.OK ? this.ACCESS_OK : this.ACCESS_ERROR);

    const displayResult = await this.probe(displayUrl, displayData);
    this.registIFAccessResult(this.IF_EPOSDISPLAY, displayResult === this.OK ? this.ACCESS_OK : this.ACCESS_ERROR);

    return Date.now() - startTime;
  }

  public setSocket(socket: any): void {
    this.socket_p = socket;
  }

  public emit(eposmsg: any): void {
    try {
      if (!this.socket_p) {
        return;
      }
      this.socket_p.emit('message', eposmsg.toTransmissionForm());
    } catch (e) {
      throw new Error(this.ERROR_SYSTEM);
    }
  }

  public setAddress(protocol: string, address: string, port: string): void {
    this.protocol_p = protocol;
    this.address_p = address;
    this.port_p = port;
    this.usableIF_p = 0;
  }

  public getAddressWithProtocol(): string {
    return `${this.protocol_p}://${this.address_p}`;
  }

  public getSocketIoURL(): string {
    return `${this.getAddressWithProtocol()}:${this.port_p}`;
  }

  public registCallback(callback: (result: string) => void): void {
    if (typeof callback === 'function') {
      this.callback_p = callback;
    }
  }

  public changeStatus(target: number, status: number): void {
    switch (target) {
      case this.IF_ALL:
        this.dev_status_p = status;
        this.ws_status_p = status;
        break;
      case this.IF_EPOSDEVICE:
        this.dev_status_p = status;
        break;
      default:
        this.ws_status_p = status;
        break;
    }
  }

  public status(target: number): number {
    return target === this.IF_EPOSDEVICE ? this.dev_status_p : this.ws_status_p;
  }

  public isUsableDeviceIF(): boolean {
    return (this.usableIF_p & this.IF_EPOSDEVICE) === this.IF_EPOSDEVICE;
  }

  public isUsablePrintIF(): boolean {
    return this.isUsableDeviceIF() || (this.usableIF_p & this.IF_EPOSPRINT) === this.IF_EPOSPRINT;
  }

  public isUsableDisplayIF(): boolean {
    return this.isUsableDeviceIF() || (this.usableIF_p & this.IF_EPOSDISPLAY) === this.IF_EPOSDISPLAY;
  }

  public registIFAccessResult(type: number, code: string): void {
    if (code === this.ACCESS_OK) {
      this.changeStatus(type, this.CONNECT);
      this.usableIF_p |= type;
    }

    if (type === this.IF_EPOSDEVICE) {
      let result = this.ERROR_PARAMETER;
      if (this.usableIF_p & this.IF_ALL) {
        result = this.protocol_p === 'http' ? this.OK : this.SSL_CONNECT_OK;
      }
      if (code === this.ACCESS_TIMEOUT) {
        result = this.ERROR_TIMEOUT;
      }
      if (this.callback_p) {
        try {
          this.callback_p(result);
        } catch (e) {
          // handle callback errors if necessary
        }
        this.callback_p = null;
      }
    }
  }
}
