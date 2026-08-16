import { SendParams } from '../types';
import { ePOSBuilder } from './ePOSBuilder';
import { validatePrintJobId } from './utils';
import { buildSoapEnvelope, postPrintRequest, PrintServiceError, type FetchLike, type PrintServiceResponse } from './httpTransport';
import * as STATUS from '../constants/status';

// The status poll runs every few seconds; it must not inherit `timeout`, which
// is the budget for a print job (5 minutes by default) and would pile up
// queries the printer answered long ago.
const MONITOR_TIMEOUT = 10000;

/** What the printer answered a print request with. `sq` is the socket
 * transport's sequence number, absent over HTTP. */
export type ReceiveHandler = (response: PrintServiceResponse, sq?: number) => void;

/** The request itself failed: no reply, or one that couldn't be parsed. */
export type ErrorHandler = (error: { status: number; responseText: string }, sq?: number) => void;

/** A status/battery reading, as an ASB bit field (see the ASB_* constants). */
export type StatusHandler = (value: number) => void;

/** A transition with nothing to report beyond having happened. */
export type EventHandler = () => void;

interface ePOSEvents {
  onreceive: ReceiveHandler | null;
  onerror: ErrorHandler | null;
  onstatuschange: StatusHandler | null;
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
  onbatterystatuschange: StatusHandler | null;
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
  fetchImpl?: FetchLike;

  // ASB Constants, same values as the module-level `constants/status` exports.
  ASB_NO_RESPONSE = STATUS.ASB_NO_RESPONSE;
  ASB_PRINT_SUCCESS = STATUS.ASB_PRINT_SUCCESS;
  ASB_DRAWER_KICK = STATUS.ASB_DRAWER_KICK;
  ASB_BATTERY_OFFLINE = STATUS.ASB_BATTERY_OFFLINE;
  ASB_OFF_LINE = STATUS.ASB_OFF_LINE;
  ASB_COVER_OPEN = STATUS.ASB_COVER_OPEN;
  ASB_PAPER_FEED = STATUS.ASB_PAPER_FEED;
  ASB_WAIT_ON_LINE = STATUS.ASB_WAIT_ON_LINE;
  ASB_PANEL_SWITCH = STATUS.ASB_PANEL_SWITCH;
  ASB_MECHANICAL_ERR = STATUS.ASB_MECHANICAL_ERR;
  ASB_AUTOCUTTER_ERR = STATUS.ASB_AUTOCUTTER_ERR;
  ASB_UNRECOVER_ERR = STATUS.ASB_UNRECOVER_ERR;
  ASB_AUTORECOVER_ERR = STATUS.ASB_AUTORECOVER_ERR;
  ASB_RECEIPT_NEAR_END = STATUS.ASB_RECEIPT_NEAR_END;
  ASB_RECEIPT_END = STATUS.ASB_RECEIPT_END;
  ASB_BUZZER = STATUS.ASB_BUZZER;
  ASB_WAIT_REMOVE_LABEL = STATUS.ASB_WAIT_REMOVE_LABEL;
  ASB_NO_LABEL = STATUS.ASB_NO_LABEL;
  ASB_SPOOLER_IS_STOPPED = STATUS.ASB_SPOOLER_IS_STOPPED;
  DRAWER_OPEN_LEVEL_LOW = STATUS.DRAWER_OPEN_LEVEL_LOW;
  DRAWER_OPEN_LEVEL_HIGH = STATUS.DRAWER_OPEN_LEVEL_HIGH;

  /**
   * What `startMonitor()` seeds `status` with so the first reading is reported
   * in full: `fireStatusEvent` reads it as "nothing measured yet", so it has to
   * be the sentinel that implementation checks (Printer overrides both).
   */
  protected monitorSeedStatus = 0;

  // Event Handlers
  onreceive: ReceiveHandler | null = null;
  onerror: ErrorHandler | null = null;
  onstatuschange: StatusHandler | null = null;
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
  onbatterystatuschange: StatusHandler | null = null;

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

  /** Vendor-named alias of {@link startMonitor}. */
  open(): void {
    this.startMonitor();
  }

  /** Vendor-named alias of {@link stopMonitor}. */
  close(): void {
    this.stopMonitor();
  }

  /**
   * Starts polling the printer's status every `interval` ms, firing
   * `onstatuschange` and the paper/cover/online/battery callbacks as the ASB
   * bits change. Calling it while already monitoring does nothing.
   */
  startMonitor(): boolean {
    if (!this.enabled) {
      this.enabled = true;
      this.status = this.monitorSeedStatus;
      this.battery = 0;
      void this.sendStartMonitorCommand();
    }
    return true;
  }

  /** Stops the poll, aborting the status query in flight. */
  stopMonitor(): boolean {
    this.enabled = false;
    if (this.intervalid) {
      clearTimeout(this.intervalid);
      this.intervalid = null;
    }
    if (this.intervalController) {
      this.intervalController.abort();
      this.intervalController = null;
    }
    return true;
  }

  /** Schedules the next status query. Runs at the end of each one. */
  updateStatus(): void {
    let delay = this.interval;
    if (this.enabled) {
      if (isNaN(delay) || delay < 1000) {
        delay = 3000;
      }
      this.intervalid = setTimeout(() => {
        this.intervalid = null;
        if (this.enabled) {
          void this.sendStartMonitorCommand();
        }
      }, delay);
    }
    this.intervalController = null;
  }

  /**
   * One status query: an empty print request, which is what the ePOS-Print
   * service answers with the ASB word. Deliberately not routed through
   * `send()`, which would take ownership of whatever the caller has built and
   * print it on the next tick.
   */
  protected async sendStartMonitorCommand(): Promise<void> {
    const soap = buildSoapEnvelope(new ePOSBuilder().toString());
    const controller = new AbortController();
    this.intervalController = controller;

    try {
      const res = await postPrintRequest(this.address, soap, MONITOR_TIMEOUT, controller.signal, this.fetchImpl);
      this.fireMonitorStatus(res.status, res.battery);
    } catch {
      this.fireMonitorStatus(this.ASB_NO_RESPONSE, 0);
    } finally {
      this.updateStatus();
    }
  }

  /** Printer keeps its own vendor-faithful copy, see `monitorSeedStatus`. */
  protected fireMonitorStatus(status: number, battery: number): void {
    fireStatusEvent(this, status, battery);
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
        // No explicit request/printjobid, if something was built via
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

    // Whatever ended up classified as a printjobid has to actually look like
    // one. Otherwise a body passed where a request was meant falls through
    // the /^<epos/ test above, gets sent as a status query, prints nothing,
    // and still resolves with success: true.
    validatePrintJobId(printjobid);

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
   * with the printer's parsed response directly: no need to wire up
   * onreceive/onerror first. Rejects (throws) only for an actual print
   * request that failed; a status/job query that can't reach the printer
   * resolves with an ASB_NO_RESPONSE status instead, matching the original
   * SDK's non-throwing status-polling behavior.
   */
  async send(...params: [string?, string?, string?]): Promise<PrintServiceResponse> {
    const { address, request, printjobid, isPrintRequest } = this.getSendParams(params);
    const isStatusQuery = !isPrintRequest;
    if (isPrintRequest) {
      // send() takes ownership of the builder state: the body is already
      // consumed by now, and force applies to the job it was set for, not
      // to every job after it (vendor Printer.send() clears it the same way).
      this.force = false;
    }
    const soap = buildSoapEnvelope(request, printjobid);

    try {
      let res = await postPrintRequest(address, soap, this.timeout, undefined, this.fetchImpl);
      // Same normalization the vendor applies inside its onreceive path,
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
      if (isStatusQuery) {
        fireStatusEvent(this, this.ASB_NO_RESPONSE, 0);
        return { success: false, code: '', status: this.ASB_NO_RESPONSE, battery: 0, printjobid: printjobid ?? '' };
      }
      fireErrorEvent(this, status, responseText);
      throw new PrintServiceError(status, responseText);
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
