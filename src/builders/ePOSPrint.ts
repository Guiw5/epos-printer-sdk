import { SendParams } from '../types';
import { ePOSBuilder } from './ePOSBuilder';
import { buildSoapEnvelope, postPrintRequest, PrintServiceError, type PrintServiceResponse } from './httpTransport';

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
  intervalController: AbortController | null = null;

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
      void this.send();
    }
  }

  close(): void {
    this.enabled = false;
    if (this.intervalid) {
      clearTimeout(this.intervalid);
      this.intervalid = null;
    }
    if (this.intervalController) {
      this.intervalController.abort();
      this.intervalController = null;
    }
  }

  getPrintJobStatus(printjobid: string): Promise<PrintServiceResponse> {
    return this.send(printjobid);
  }

  getSendParams(params: [string?, string?, string?]): SendParams {
    let address: string = this.address;
    let request: string = new ePOSBuilder().toString();
    let printjobid: string = '';

    let isPrintRequest = Boolean(params.find(p => p && /^<epos/.test(p)));

    const len = params.length;
    const [first] = params;
    switch (len) {
      case 0: {
        // No explicit request/printjobid — if something was built via
        // chained add*() calls (the EposHttpPrinter pattern: build, then
        // send()), send that instead of silently sending an empty job.
        // Untouched builder state is empty either way, so plain status
        // pings (send() with nothing built, e.g. open()'s polling loop)
        // behave exactly as before.
        if (this.message) {
          request = this.toString();
          isPrintRequest = true;
          // Consume the buffer: send() takes ownership of whatever was
          // built (vendor Printer.send() does the same via setXmlString("")
          // on both transports). Without this, the next chained
          // add*().send() would silently re-print everything sent before.
          this.message = '';
        }
        break;
      }
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
  send(printjobid?: string): Promise<PrintServiceResponse>;

  /**
   * Fetch status for a given printjobid in the given address
   * @param address string
   * @param printjobid string
   */
  send(address: string, printjobid: string | undefined): Promise<PrintServiceResponse>;

  /**
   * Send a print request to the printer with the given printerjobid
   * @param request string
   * @param printjobid string
   *
   */
  send(request: string, printjobid: string | undefined): Promise<PrintServiceResponse>;

  /**
   * Send a print request to the printer in the given adress with the given printerjobid
   * @param address
   * @param request
   * @param printjobid
   */
  send(address: string, request: string, printjobid: string | undefined): Promise<PrintServiceResponse>;

  /**
   * Sends the built request (or, for a status/job query, none) and resolves
   * with the printer's parsed response directly — no need to wire up
   * onreceive/onerror first. Rejects (throws) only for an actual print
   * request that failed; a status/job query that can't reach the printer
   * resolves with an ASB_NO_RESPONSE status instead, matching the original
   * SDK's non-throwing status-polling behavior.
   */
  async send(...params: [string?, string?, string?]): Promise<PrintServiceResponse> {
    const { address, request, printjobid, isPrintRequest } = this.getSendParams(params);
    const isMonitoring = !isPrintRequest;
    const soap = buildSoapEnvelope(request, printjobid);

    const controller = new AbortController();
    if (isMonitoring) {
      this.intervalController = controller;
    }

    try {
      let res = await postPrintRequest(address, soap, this.timeout, controller.signal);
      // Same normalization the vendor applies inside its onreceive path —
      // done here so the resolved promise and the legacy callback report
      // the identical code (apps switch on ERROR_DEVICE_BUSY).
      if (res.code === 'EX_ENPC_TIMEOUT') {
        res = { ...res, code: 'ERROR_DEVICE_BUSY' };
      }
      if (isPrintRequest) {
        fireReceiveEvent(this, res.success, res.code, res.status, res.battery, res.printjobid);
      } else {
        fireStatusEvent(this, res.status, res.battery);
      }
      return res;
    } catch (err) {
      const { status, responseText } = err instanceof PrintServiceError ? err : new PrintServiceError(0, String(err));
      if (isMonitoring) {
        fireStatusEvent(this, this.ASB_NO_RESPONSE, 0);
        return { success: false, code: '', status: this.ASB_NO_RESPONSE, battery: 0, printjobid: printjobid ?? '' };
      }
      fireErrorEvent(this, status, responseText);
      throw new PrintServiceError(status, responseText);
    } finally {
      if (isMonitoring) {
        updateStatus(this);
      }
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
        void epos.send();
      }
    }, delay);
  }
  epos.intervalController = null;
}
