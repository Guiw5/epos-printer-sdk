import { SendParams } from '../types';
import { ePOSBuilder } from './ePOSBuilder';

type EventHandler = (event?: any, sq?: number) => void;

interface ePOSEvents {
  onreceive: EventHandler | null;
  onerror: EventHandler | null;
  onstatuschange: EventHandler | null;
  ononline: EventHandler | null;
  onoffline: EventHandler | null;
  onpoweroff: EventHandler | null;
  oncoverok: EventHandler | null;
  oncoveropen: EventHandler | null;
  onpaperok: EventHandler | null;
  onpaperend: EventHandler | null;
  onpapernearend: EventHandler | null;
  ondrawerclosed: EventHandler | null;
  ondraweropen: EventHandler | null;
  onbatterylow: EventHandler | null;
  onbatteryok: EventHandler | null;
  onbatterystatuschange: EventHandler | null;
}

export class ePOSPrint extends ePOSBuilder implements ePOSEvents {
  address: string;
  enabled: boolean;
  interval: number;
  timeout: number;
  status: number;
  battery: number;
  drawerOpenLevel: number;
  intervalid: number | NodeJS.Timeout | null = null;
  intervalxhr: XMLHttpRequest | null = null;

  // ASB Constants
  ASB_NO_RESPONSE = 1;
  ASB_PRINT_SUCCESS = 2;
  ASB_DRAWER_KICK = 4;
  ASB_BATTERY_OFFLINE = 4;
  ASB_OFF_LINE = 8;
  ASB_COVER_OPEN = 32;
  ASB_PAPER_FEED = 64;
  ASB_WAIT_ON_LINE = 256;
  ASB_PANEL_SWITCH = 512;
  ASB_MECHANICAL_ERR = 1024;
  ASB_AUTOCUTTER_ERR = 2048;
  ASB_UNRECOVER_ERR = 8192;
  ASB_AUTORECOVER_ERR = 16384;
  ASB_RECEIPT_NEAR_END = 131072;
  ASB_RECEIPT_END = 524288;
  ASB_BUZZER = 16777216;
  ASB_WAIT_REMOVE_LABEL = 16777216;
  ASB_NO_LABEL = 67108864;
  ASB_SPOOLER_IS_STOPPED = 2147483648;
  DRAWER_OPEN_LEVEL_LOW = 0;
  DRAWER_OPEN_LEVEL_HIGH = 1;

  // Event Handlers
  onreceive: EventHandler | null = null;
  onerror: EventHandler | null = null;
  onstatuschange: EventHandler | null = null;
  ononline: EventHandler | null = null;
  onoffline: EventHandler | null = null;
  onpoweroff: EventHandler | null = null;
  oncoverok: EventHandler | null = null;
  oncoveropen: EventHandler | null = null;
  onpaperok: EventHandler | null = null;
  onpaperend: EventHandler | null = null;
  onpapernearend: EventHandler | null = null;
  ondrawerclosed: EventHandler | null = null;
  ondraweropen: EventHandler | null = null;
  onbatterylow: EventHandler | null = null;
  onbatteryok: EventHandler | null = null;
  onbatterystatuschange: EventHandler | null = null;

  constructor(address: string) {
    super();
    this.address = address;
    this.enabled = false;
    this.interval = 3000;
    this.timeout = 300000;
    this.status = 0;
    this.battery = 0;
    this.drawerOpenLevel = 0;
  }

  open(): void {
    if (!this.enabled) {
      this.enabled = true;
      this.status = 0;
      this.battery = 0;
      this.send();
    }
  }

  close(): void {
    this.enabled = false;
    if (this.intervalid) {
      clearTimeout(this.intervalid);
      this.intervalid = null;
    }
    if (this.intervalxhr) {
      this.intervalxhr.abort();
      this.intervalxhr = null;
    }
  }

  getPrintJobStatus(printjobid: string): void {
    this.send(printjobid);
  }

  getSendParams(params: [string?, string?, string?]): SendParams {
    let address: string = this.address;
    let request: string = new ePOSBuilder().toString();
    let printjobid: string = '';
    
    const isPrintRequest = Boolean(params.find(p => p && /^<epos/.test(p)));

    const len = params.length;
    const [first] = params;
    switch (len) {
      case 0: break;
      case 1: {
        if (/^<epos/.test(first!)) {
          // sending job
          [request = request] = params;
        } else {
          // querying job status
          [printjobid = printjobid] = params;
        }
        break;
      }
      case 2: {
        if (/^<epos/.test(first!)) {
          // sending job with printjobid
          [request = request, printjobid = printjobid] = params;
        } else {
          // querying status with printjobid to another address
          [address = address, printjobid = printjobid] = params;
        }
        break;
      }        
      case 3: {
        // sending job with printjobid to another address
        [address = address, request = request, printjobid = printjobid] = params;
        break;
      }
      default: throw new Error("Invalid number of arguments");
    }
    
    return { address, request, printjobid, isPrintRequest };
  }

  /**
   * Fetch status
   * @param printjobid
   */
  send(printjobid?: string): void;
  
  /**
   * Fetch status for a given printjobid in the given address
   * @param address string
   * @param printjobid string
   */
  send(address: string, printjobid: string | undefined): void;
  
  /**
   * Send a print request to the printer with the given printerjobid
   * @param request string
   * @param printjobid string
   * 
   */
  send(request: string, printjobid: string | undefined): void;

  /**
   * Send a print request to the printer in the given adress with the given printerjobid
   * @param address 
   * @param request 
   * @param printjobid 
   */
  send(address: string, request: string, printjobid: string | undefined): void;
  
  send(...params: [string?, string?, string?]): void {
    let soap: string;
    let xhr: XMLHttpRequest;
    let tid: number | NodeJS.Timeout;
    let success: boolean;
    let code: string;
    let status: number;
    let battery: number;
    const epos = this;
    const { address, request, printjobid, isPrintRequest } = this.getSendParams(params);
    const isMonitoring = !isPrintRequest;

    soap = '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">';
    if (printjobid) {
      soap += 
      `<s:Header><parameter xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
        <printjobid>${printjobid}</printjobid>
      </parameter></s:Header>`;
    }
    soap += `<s:Body>${request}</s:Body></s:Envelope>`;

    xhr = new XMLHttpRequest();
    xhr.open("POST", address, true);
    xhr.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
    xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT");
    xhr.setRequestHeader("SOAPAction", '""');
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        clearTimeout(tid);
        if (xhr.status === 200 && xhr.responseXML) {
          const resXML = xhr.responseXML.getElementsByTagName("response");
          if (resXML.length > 0) {
            success = /^(1|true)$/.test(resXML[0].getAttribute("success") || "");
            code = resXML[0].getAttribute("code") || "";
            status = parseInt(resXML[0].getAttribute("status") || "0");
            battery = parseInt(resXML[0].getAttribute("battery") || "0");
            const printjobidXML = xhr.responseXML.getElementsByTagName("printjobid");
            const printjobidRes = printjobidXML.length > 0 ? printjobidXML[0].textContent || "" : "";
            if (isPrintRequest) {
              fireReceiveEvent(epos, success, code, status, battery, printjobidRes);
            } else {
              fireStatusEvent(epos, status, battery);
            }
          } else if (isPrintRequest) {
            fireErrorEvent(epos, xhr.status, xhr.responseText);
          } else {
            fireStatusEvent(epos, epos.ASB_NO_RESPONSE, 0);
          }
          // xhr.status !== 200
        } else if (isPrintRequest) {
          fireErrorEvent(epos, xhr.status, xhr.responseText);
        } else {
          fireStatusEvent(epos, epos.ASB_NO_RESPONSE, 0);
        }

        if (isMonitoring) {
          updateStatus(epos);
        }
      };

      tid = setTimeout(() => xhr.abort(), epos.timeout);
      xhr.send(soap);
    }

    if (isMonitoring) {
      epos.intervalxhr = xhr;
    }
  }
}

function fireReceiveEvent(epos: ePOSPrint, success: boolean, code: string, status: number, battery: number, printjobid: string): void {
  if (code === "EX_ENPC_TIMEOUT") {
    code = "ERROR_DEVICE_BUSY";
  }
  if (epos.onreceive) {
    epos.onreceive({
      success,
      code,
      status,
      battery,
      printjobid,
    });
  }
}

function fireStatusEvent(epos: ePOSPrint, status: number, battery: number): void {
  let diff, difb;
  if (status === 0 || status === epos.ASB_NO_RESPONSE) {
    status = epos.status | epos.ASB_NO_RESPONSE;
  }
  diff = epos.status === 0 ? ~0 : epos.status ^ status;
  difb = epos.status === 0 ? ~0 : epos.battery ^ battery;
  epos.status = status;
  epos.battery = battery;

  if (diff && epos.onstatuschange) {
    epos.onstatuschange(status);
  }
  if (difb && epos.onbatterystatuschange) {
    epos.onbatterystatuschange(battery);
  }

  if (diff & (epos.ASB_NO_RESPONSE | epos.ASB_OFF_LINE)) {
    if (status & epos.ASB_NO_RESPONSE) {
      if (epos.onpoweroff) epos.onpoweroff();
    } else if (status & epos.ASB_OFF_LINE) {
      if (epos.onoffline) epos.onoffline();
    } else if (epos.ononline) {
      epos.ononline();
    }
  }

  if (diff & epos.ASB_COVER_OPEN) {
    if (status & epos.ASB_COVER_OPEN) {
      if (epos.oncoveropen) epos.oncoveropen();
    } else if (epos.oncoverok) {
      epos.oncoverok();
    }
  }

  if (diff & (epos.ASB_RECEIPT_END | epos.ASB_RECEIPT_NEAR_END)) {
    if (status & epos.ASB_RECEIPT_END) {
      if (epos.onpaperend) epos.onpaperend();
    } else if (status & epos.ASB_RECEIPT_NEAR_END) {
      if (epos.onpapernearend) epos.onpapernearend();
    } else if (epos.onpaperok) {
      epos.onpaperok();
    }
  }

  if (diff & epos.ASB_DRAWER_KICK) {
    if (status & epos.ASB_DRAWER_KICK) {
      if (epos.drawerOpenLevel === epos.DRAWER_OPEN_LEVEL_HIGH) {
        if (epos.ondraweropen) epos.ondraweropen();
      } else if (epos.ondrawerclosed) {
        epos.ondrawerclosed();
      }
      if (epos.onbatterylow) epos.onbatterylow();
    } else {
      if (epos.drawerOpenLevel === epos.DRAWER_OPEN_LEVEL_HIGH) {
        if (epos.ondrawerclosed) epos.ondrawerclosed();
      } else if (epos.ondraweropen) {
        epos.ondraweropen();
      }
      if (epos.onbatteryok) epos.onbatteryok();
    }
  }
}

function fireErrorEvent(epos: ePOSPrint, status: number, responseText: string): void {
  if (epos.onerror) {
    epos.onerror({
      status,
      responseText,
    });
  }
}

function updateStatus(epos: ePOSPrint): void {
  let delay = epos.interval;
  if (epos.enabled) {
    if (isNaN(delay) || delay < 1000) {
      delay = 3000;
    }
    epos.intervalid = setTimeout(() => {
      epos.intervalid = null;
      if (epos.enabled) {
        epos.send();
      }
    }, delay);
  }
  epos.intervalxhr = null;
}
