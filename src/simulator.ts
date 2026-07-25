// A simulated ePOS-Print service: a fetch-shaped function you can hand to
// EposHttpPrinter instead of the network. Separate entry point on purpose —
// none of this ships to consumers who don't import it.
//
// It speaks the real protocol (parses the SOAP body, answers with genuine
// ePOS-Print XML and ASB status bitmasks), so code written against it behaves
// the same against hardware. Useful for local development without a printer,
// automated tests, and live demos.

import type { FetchLike } from './builders/httpTransport';

/** Bits of the ASB status word this simulator models. */
const ASB_NO_RESPONSE = 1;
const ASB_PRINT_SUCCESS = 2;
const ASB_DRAWER_KICK = 4;
const ASB_OFF_LINE = 8;
const ASB_COVER_OPEN = 32;
const ASB_RECEIPT_NEAR_END = 131072;
const ASB_RECEIPT_END = 524288;

export interface SimulatedPrinterState {
  /** Printer is powered on and reachable. Default: true. */
  online: boolean;
  /** Roll cover open — printing fails while true. Default: false. */
  coverOpen: boolean;
  /** Sheets of paper left. Reaching 0 fails prints with EPTR_REC_EMPTY. */
  paper: number;
  /** Cash drawer open state, toggled by addPulse. Default: false. */
  drawerOpen: boolean;
}

export interface SimulatorOptions {
  /** Initial state. Anything omitted uses a healthy default. */
  initialState?: Partial<SimulatedPrinterState>;
  /** Artificial round-trip latency in ms, to mimic a real printer. Default: 150. */
  latencyMs?: number;
  /**
   * Called with every job the printer "prints", so a demo UI can render the
   * receipt, or a test can assert on the XML that was actually sent.
   */
  onPrint?: (job: { xml: string; text: string; printjobid: string }) => void;
}

export interface Simulator {
  /** Pass this to `new EposHttpPrinter(host, { fetch })`. */
  fetch: FetchLike;
  /** Current simulated state — mutate it to script failures in a demo. */
  state: SimulatedPrinterState;
  /** Everything "printed" so far, newest last. */
  jobs: Array<{ xml: string; text: string; printjobid: string }>;
  /** Restore the initial state and clear the job history. */
  reset(): void;
}

const DEFAULT_STATE: SimulatedPrinterState = {
  online: true,
  coverOpen: false,
  paper: 50,
  drawerOpen: false,
};

/** Renders the <text> content of a job, so a demo can show the receipt. */
function extractText(xml: string): string {
  return [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) =>
      m[1]
        .replace(/&#10;/g, '\n')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
    )
    .join('');
}

function statusWord(state: SimulatedPrinterState, printed: boolean): number {
  let status = 0;
  if (!state.online) return ASB_NO_RESPONSE | ASB_OFF_LINE;
  if (printed) status |= ASB_PRINT_SUCCESS;
  if (state.coverOpen) status |= ASB_COVER_OPEN;
  if (state.drawerOpen) status |= ASB_DRAWER_KICK;
  if (state.paper <= 0) status |= ASB_RECEIPT_END;
  else if (state.paper <= 5) status |= ASB_RECEIPT_NEAR_END;
  return status;
}

function soapResponse(success: boolean, code: string, status: number, printjobid: string): string {
  const jobTag = printjobid ? `<printjobid>${printjobid}</printjobid>` : '';
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
    `<response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" ` +
    `success="${success}" code="${code}" status="${status}" battery="0">${jobTag}</response>` +
    '</s:Body></s:Envelope>'
  );
}

/**
 * Creates a simulated ePOS-Print printer.
 *
 * @example
 * import { EposHttpPrinter } from 'epos-printer-sdk/http';
 * import { createSimulator } from 'epos-printer-sdk/simulator';
 *
 * const sim = createSimulator({ initialState: { paper: 2 } });
 * const printer = new EposHttpPrinter('demo', { fetch: sim.fetch });
 *
 * await printer.addText('hi\n').addCut('feed').send(); // sim.jobs[0].text === 'hi\n'
 * sim.state.coverOpen = true;                          // next print fails
 */
export function createSimulator(options: SimulatorOptions = {}): Simulator {
  const { latencyMs = 150, onPrint } = options;
  const initial = { ...DEFAULT_STATE, ...options.initialState };

  const sim: Simulator = {
    state: { ...initial },
    jobs: [],
    reset() {
      sim.state = { ...initial };
      sim.jobs.length = 0;
    },
    fetch: async (_url, init) => {
      const body = String(init.body ?? '');

      if (latencyMs > 0) {
        await new Promise((r) => setTimeout(r, latencyMs));
      }

      // An unreachable printer rejects at the network layer, exactly like fetch
      // does — not with an HTTP error the caller could misread as a response.
      if (!sim.state.online) {
        throw new TypeError('Failed to fetch');
      }

      const printjobid = /<printjobid>([^<]*)<\/printjobid>/.exec(body)?.[1] ?? '';
      const jobXml = /<epos-print[^>]*>([\s\S]*)<\/epos-print>/.exec(body)?.[1] ?? '';
      const isPrintJob = jobXml.trim().length > 0;

      const respond = (success: boolean, code: string, printed = false) =>
        new Response(soapResponse(success, code, statusWord(sim.state, printed), printjobid), {
          status: 200,
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        });

      // A status query (empty body) always answers, reporting current state.
      if (!isPrintJob) {
        return respond(true, '');
      }

      if (sim.state.coverOpen) {
        return respond(false, 'EPTR_COVER_OPEN');
      }
      if (sim.state.paper <= 0) {
        return respond(false, 'EPTR_REC_EMPTY');
      }

      if (/<pulse\b/.test(jobXml)) {
        sim.state.drawerOpen = true;
      }
      sim.state.paper -= 1;

      const job = { xml: jobXml, text: extractText(jobXml), printjobid };
      sim.jobs.push(job);
      onPrint?.(job);

      return respond(true, '', true);
    },
  };

  return sim;
}
