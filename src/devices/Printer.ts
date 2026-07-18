import { CanvasPrint } from "../components/CanvasPrint";
import { ePOSBuilder } from "../builders/ePOSBuilder";
import { MessageFactory } from "../components/MessageFactory";
import type { ePOSDevice } from "../components/ePOSDevice";
import { Data } from "../components/ePosDeviceMessage";
import { buildSoapEnvelope, postPrintRequest, PrintServiceError, type PrintServiceResponse } from "../builders/httpTransport";
export class Printer extends CanvasPrint {
  deviceID: string;
  isCrypto: boolean;
  ePosDev: ePOSDevice;
  timeout: number;
  message: string;
  timeoutid: any;

  constructor(deviceID: string, isCrypto: boolean, ePOSDevice: ePOSDevice) {
    super(deviceID);
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.ePosDev = ePOSDevice;
    this.timeout = 10000;
    this.message = '';
  }
  
  setXmlString(xml: string): void {
    this.message = xml;
  }

  getXmlString(): string {
    return this.message;
  }

  getPrintJobStatus(printjobid: string): Promise<PrintServiceResponse> {
    this.setXmlString("");
    return this.send(printjobid);
  }

  send(printjobid?: string): Promise<PrintServiceResponse>;
  send(printdata: string, printjobid: string): Promise<PrintServiceResponse>;
  send(address: string, printdata: string, printjobid: string): Promise<PrintServiceResponse>;
  async send(...params: [string?, string?, string?]): Promise<PrintServiceResponse> {
    let address = `${this.connection?.getOrigin()}/cgi-bin/epos/service.cgi?devid=${this.deviceID}&timeout=${this.timeout}`;
    let printdata = this.toString();
    let printjobid;

    switch (params.length) {
      case 1:
        [printjobid] = params;
        break;
      case 2:
        [printdata = printdata, printjobid] = params;
        break;
      case 3:
        [address = address, printdata = printdata, printjobid] = params;
        break;
      default:
        break;
    }

    if (!this.ePosDev.getEposprint() && this.connection?.isUsableDeviceIF()) {
      // The socket transport is fire-and-forget here: the real result
      // arrives later via client_send/client_onreceive on the device-data
      // message flow, not synchronously from this call.
      try {
        const data = { type: "print", printdata, printjobid, timeout: this.timeout } as Data;
        const eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
        this.connection.emit(eposmsg);
        this.force = false;
        this.setXmlString("");
      } catch {
        // Ignored: nothing more to do if the socket emit itself throws.
      }
      return { success: true, code: '', status: 0, battery: 0, printjobid: printjobid ?? '' };
    }

    const soap = buildSoapEnvelope(printdata, printjobid);
    try {
      const res = await postPrintRequest(address, soap, this.timeout);
      this.fireReceiveEvent(res.success, res.code, res.status, res.battery, res.printjobid, 0);
      return res;
    } catch (err) {
      const { status, responseText } = err instanceof PrintServiceError ? err : new PrintServiceError(0, String(err));
      this.fireErrorEvent(status, responseText, 0);
      throw new PrintServiceError(status, responseText);
    }
  }

  fireReceiveEvent(success: boolean, code: string, status: number, battery: number, printjobid: string, sq: number): void {
    if (code === "EX_ENPC_TIMEOUT") {
      code = "ERROR_DEVICE_BUSY";
    }
    this.onreceive?.({ success, code, status, battery, printjobid }, sq);
  }

  fireErrorEvent(status: number, responseText: string, sq: number): void {
    this.onerror?.({ status, responseText }, sq);
    this.ePosDev.cleanup();
  }

  fireStatusEvent(epos: Printer, status: number, battery: number): void {
    if (!epos) {
      console.log("firing status event: epos object is undefined");
    }
    if (status === 0 || status === this.ASB_NO_RESPONSE) {
      status = this.status | this.ASB_NO_RESPONSE;
    }

    // Comparaciones diferenciales de estado y batería
    const statusDiff = this.status === this.ASB_DRAWER_KICK ? ~0 : this.status ^ status;
    const batteryDiff = this.status === 0 ? ~0 : this.battery ^ battery;

    // Actualiza el estado y la batería
    this.status = status;
    this.battery = battery;

    // Llama a los eventos de cambio de estado si ha habido una diferencia
    if (statusDiff && this.onstatuschange) {
      this.onstatuschange(status);
    }
    if (batteryDiff && this.onbatterystatuschange) {
      this.onbatterystatuschange(battery);
    }

    // Manejo de diferentes tipos de cambios de estado
    if (statusDiff & (this.ASB_NO_RESPONSE | this.ASB_OFF_LINE)) {
      if (status & this.ASB_NO_RESPONSE) {
        this.onpoweroff?.();
      } else if (status & this.ASB_OFF_LINE) {
        this.onoffline?.();
      } else {
        this.ononline?.();
      }
    }

    if (statusDiff & this.ASB_COVER_OPEN) {
      if (status & this.ASB_COVER_OPEN) {
        this.oncoveropen?.();
      } else {
        this.oncoverok?.();
      }
    }

    if (statusDiff & (this.ASB_RECEIPT_END | this.ASB_RECEIPT_NEAR_END)) {
      if (status & this.ASB_RECEIPT_END) {
        this.onpaperend?.();
      } else if (status & this.ASB_RECEIPT_NEAR_END) {
        this.onpapernearend?.();
      } else {
        this.onpaperok?.();
      }
    }

    if (statusDiff & this.ASB_DRAWER_KICK) {
      if (status & this.ASB_DRAWER_KICK) {
        if (this.drawerOpenLevel === this.DRAWER_OPEN_LEVEL_HIGH) {
          this.ondraweropen?.();
        } else {
          this.ondrawerclosed?.();
        }
        this.onbatterylow?.();
      } else {
        if (this.drawerOpenLevel === this.DRAWER_OPEN_LEVEL_HIGH) {
          this.ondrawerclosed?.();
        } else {
          this.ondraweropen?.();
        }
        this.onbatteryok?.();
      }
    }
  }

  startMonitor(): boolean {
    const address = `${this.connection?.getOrigin()}/cgi-bin/epos/service.cgi?devid=${this.deviceID}&timeout=10000`;

    if (!this.enabled) {
      this.address = address;
      this.enabled = true;
      this.status = this.ASB_DRAWER_KICK;
      void this.sendStartMonitorCommand();
    }

    return true;
  }

  stopMonitor(): boolean {
    this.enabled = false;
    if (this.timeoutid) {
      clearTimeout(this.timeoutid);
      delete this.timeoutid;
    }
    return true;
  }

  finalize(): void {
    this.stopMonitor();
  }

  updateStatus(): void {
    if (this.enabled) {
      const delay = isNaN(this.interval) || this.interval < 1000 ? 3000 : this.interval;
      this.timeoutid = setTimeout(() => {
        delete this.timeoutid;
        if (this.enabled) {
          void this.sendStartMonitorCommand();
        }
      }, delay);
    }
  }

  private async sendStartMonitorCommand(): Promise<void> {
    const soap = buildSoapEnvelope(new ePOSBuilder().toString());

    try {
      const res = await postPrintRequest(this.address, soap, 10000);
      this.fireStatusEvent(this, res.status, res.battery);
    } catch {
      this.fireStatusEvent(this, this.ASB_NO_RESPONSE, 0);
    }
    this.updateStatus();
  }
}
