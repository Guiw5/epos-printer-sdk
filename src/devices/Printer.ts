import { CanvasPrint } from "../components/CanvasPrint";
import { ePOSBuilder } from "../builders/ePOSBuilder";
import { MessageFactory } from "../components/MessageFactory";
import type { ePOSDevice } from "../components/ePOSDevice";
import { Data } from "../components/ePosDeviceMessage";
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

  getPrintJobStatus(printjobid: string): void {
    this.setXmlString("");
    this.send(printjobid);
  }

  // send(): number;
  send(printjobid: string): number;
  send(printdata: string, printjobid: string): number;
  send(address: string, printdata: string, printjobid: string): number;
  send(...params: [string?, string?, string?]): number {
    let sq = -1;
    
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
      try {
        const data = { type: "print", printdata, printjobid, timeout: this.timeout } as Data;
        const eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
        this.connection.emit(eposmsg);
        this.force = false;
        this.setXmlString("");
      } catch (e) {
        sq = -1;
      }
    } else {
      const message = this.addSoapXml(printdata, printjobid);
      this.sendRequestViaHttp(address, message);
      sq = 0;
    }

    return sq;
  }

  private addSoapXml(printdata: string, printjobid?: string): string {
    let soap = '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">';
    if (printjobid) {
      soap += `<s:Header><parameter xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><printjobid>${printjobid}</printjobid></parameter></s:Header>`;
    }
    soap += `<s:Body>${printdata}</s:Body></s:Envelope>`;
    return soap;
  }

  private sendRequestViaHttp(address: string, message: string): void {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", address, true);
    xhr.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
    xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT");
    xhr.setRequestHeader("SOAPAction", '""');
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200 && xhr.responseXML) {
          this.handleSuccess(xhr.responseXML);
        } else {
          this.handleError(xhr.status, xhr.responseText);
        }
      }
    };
    xhr.send(message);
  }

  private handleSuccess(responseXML: Document): void {
    const res = responseXML.getElementsByTagName("response");
    if (res.length > 0) {
      const [response] = res;
      const code = response.getAttribute("code") || "";
      const success = /^(1|true)$/.test(response.getAttribute("success") || "");
      const status = parseInt(response.getAttribute("status") || "0");
      const battery = parseInt(response.getAttribute("battery") || "0");
      const printjobid = response.getElementsByTagName("printjobid")[0]?.textContent || "";
      this.fireReceiveEvent(success, code, status, battery, printjobid, 0);
    } else {
      this.fireErrorEvent(0, "No response received", 0);
    }
  }

  private handleError(status: number, responseText: string): void {
    this.fireErrorEvent(status, responseText, 0);
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
    let result = false;
    const address = `${this.connection?.getOrigin()}/cgi-bin/epos/service.cgi?devid=${this.deviceID}&timeout=10000`;

    try {
      if (!this.enabled) {
        this.address = address;
        this.enabled = true;
        this.status = this.ASB_DRAWER_KICK;
        this.sendStartMonitorCommand();
      }
      result = true;
    } catch (e) {
      throw e;
    }

    return result;
  }
  
  stopMonitor(): boolean {
    let result = false;
    try {
      this.enabled = false;
      if (this.timeoutid) {
        clearTimeout(this.timeoutid);
        delete this.timeoutid;
      }
      result = true;
    } catch (e) {
      throw e;
    }
    return result;
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
          this.sendStartMonitorCommand();
        }
      }, delay);
    }
  }

  private sendStartMonitorCommand(): void {
    const address = this.address;
    const request = new ePOSBuilder().toString();
    const soap = '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' + request + '</s:Body></s:Envelope>';
    const self = this;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", address, true);
    xhr.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200 && xhr.responseXML) {
        const res = xhr.responseXML.getElementsByTagName("response");
        if (res.length > 0) {
          // const success = /^(1|true)$/.test(res[0].getAttribute("success") || "");
          // const code = res[0].getAttribute("code") || "";
          const status = parseInt(res[0].getAttribute("status") || "0");
          const battery = parseInt(res[0].getAttribute("battery") || "0");
          self.fireStatusEvent(self, status, battery);
        } else {
          self.fireStatusEvent(self, self.ASB_NO_RESPONSE, 0);
        }
        self.updateStatus();
      }
    };
    xhr.send(soap);
  
  }
}
