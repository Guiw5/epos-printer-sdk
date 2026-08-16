import { CanvasPrint } from "../components/CanvasPrint";
import { MessageFactory } from "../components/MessageFactory";
import type { ePOSDevice } from "../components/ePOSDevice";
import { Data } from "../components/ePosDeviceMessage";
import { buildSoapEnvelope, postPrintRequest, PrintServiceError, type PrintServiceResponse } from "../builders/httpTransport";
import { validatePrintJobId } from "../builders/utils";
export class Printer extends CanvasPrint {
  deviceID: string;
  isCrypto: boolean;
  ePosDev: ePOSDevice;
  timeout: number;
  message: string;

  // The vendor's Printer diffs the first reading against ASB_DRAWER_KICK, not
  // against 0 like ePOSPrint does, so its seed has to match (see
  // fireStatusEvent below, kept as its own copy for that reason).
  protected monitorSeedStatus = this.ASB_DRAWER_KICK;

  constructor(deviceID: string, isCrypto: boolean, ePOSDevice: ePOSDevice) {
    super(deviceID);
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.ePosDev = ePOSDevice;
    this.timeout = 10000;
    this.message = '';
  }

  /** Vendor-named alias of {@link ePOSBuilder.setBody}. */
  setXmlString(xml: string): void {
    this.setBody(xml);
  }

  /** Vendor-named alias of {@link ePOSBuilder.getBody}. */
  getXmlString(): string {
    return this.getBody();
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

    validatePrintJobId(printjobid);

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
    // Vendor parity: Printer.send() clears the builder buffer right after
    // handing the request off, on the HTTP path too (bundle line ~3529),
    // otherwise consecutive prints resend the previous content.
    this.setXmlString('');
    this.force = false;
    try {
      const res = await postPrintRequest(address, soap, this.timeout, undefined, this.fetchImpl);
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

    // Diff the status and battery against the previous reading
    const statusDiff = this.status === this.ASB_DRAWER_KICK ? ~0 : this.status ^ status;
    const batteryDiff = this.status === 0 ? ~0 : this.battery ^ battery;

    // Store the new values
    this.status = status;
    this.battery = battery;

    // Fire change events only where something actually changed
    if (statusDiff && this.onstatuschange) {
      this.onstatuschange(status);
    }
    if (batteryDiff && this.onbatterystatuschange) {
      this.onbatterystatuschange(battery);
    }

    // Dispatch the specific transitions
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

  // The device's own endpoint, which only exists once ePOSDevice has
  // connected: everything else about the poll lives in ePOSPrint.
  startMonitor(): boolean {
    if (!this.enabled) {
      this.address = `${this.connection?.getOrigin()}/cgi-bin/epos/service.cgi?devid=${this.deviceID}&timeout=10000`;
    }
    return super.startMonitor();
  }

  finalize(): void {
    this.stopMonitor();
  }

  protected fireMonitorStatus(status: number, battery: number): void {
    this.fireStatusEvent(this, status, battery);
  }
}
