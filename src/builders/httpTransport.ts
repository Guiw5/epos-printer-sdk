// Shared HTTP transport for the ePOS-Print web service. Used by ePOSPrint
// (status polling / job status queries) and Printer (printing + monitoring)
// so the request/response plumbing only lives in one place.

import { PRINT_SERVICE_ERRORS, type PrintServiceErrorCode } from '../constants/connection';

export interface PrintServiceResponse {
  success: boolean;
  code: string;
  status: number;
  battery: number;
  printjobid: string;
}

/**
 * Thrown when the print service can't be reached or replies with something we
 * can't parse. `code` says which of those it was (see
 * {@link PRINT_SERVICE_ERRORS}), so a caller can `switch` on the cause instead
 * of matching strings; `message` is that same cause in Spanish, ready to show;
 * `status` and `responseText` keep the raw detail for a log.
 */
export class PrintServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseText: string,
    public readonly code: PrintServiceErrorCode = PRINT_SERVICE_ERRORS.ERROR,
    message: string = messageFor(code, status)
  ) {
    super(message);
    this.name = 'PrintServiceError';
  }
}

function messageFor(code: PrintServiceErrorCode, status: number): string {
  switch (code) {
    case PRINT_SERVICE_ERRORS.TIMEOUT:
      return 'La impresora no respondió a tiempo.';
    case PRINT_SERVICE_ERRORS.UNREACHABLE:
      return 'No se pudo conectar con la impresora en esa dirección.';
    case PRINT_SERVICE_ERRORS.ERROR_PARAMETER:
      return 'La dirección de la impresora no es válida.';
    default:
      return `El servicio de impresión respondió de forma inesperada (HTTP ${status}).`;
  }
}

/**
 * An address that can't be turned into a URL with a host (an empty printer
 * address is the usual way in) is a bad argument, not an unreachable printer,
 * and `fetch` would either throw for the wrong reason or, for `https:///path`,
 * quietly request a host named after the first path segment: `URL` accepts an
 * empty authority and promotes `cgi-bin` to hostname, so that form has to be
 * rejected before it gets there.
 */
export function isRequestableUrl(url: string): boolean {
  try {
    return !/^[a-z][a-z0-9+.-]*:\/\/(\/|$)/i.test(url) && new URL(url).hostname.length > 0;
  } catch {
    return false;
  }
}

export function buildSoapEnvelope(body: string, printjobid?: string): string {
  const header = printjobid
    ? `<s:Header><parameter xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><printjobid>${printjobid}</printjobid></parameter></s:Header>`
    : '';
  return `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">${header}<s:Body>${body}</s:Body></s:Envelope>`;
}

// One in-flight chain per endpoint URL, shared by every printer instance
// pointing at it. The printer processes requests one at a time regardless:
// firing 10 concurrent status queries at a real TM-T88V returns 10 successes,
// but the last one takes ~4.9s versus ~180ms on its own. Left unserialized,
// enough concurrency pushes later requests past their client-side timeout and
// they fail for no reason other than queueing. Different endpoints (different
// printers) still run fully in parallel.
const inFlightByEndpoint = new Map<string, Promise<void>>();

/**
 * Swappable fetch, so callers can drive the transport with something other
 * than the network i.e. a simulator (see `epos-printer-sdk/simulator`), a mock in
 * tests, or a custom client. Defaults to global `fetch`.
 */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * POSTs a SOAP-wrapped ePOS-Print request and parses the <response> element
 * back into a plain object. Rejects with PrintServiceError on network
 * failure, timeout, a non-200 response, or a response with no <response>
 * element to parse; its `code` says which.
 *
 * Requests to the same endpoint are serialized (see above); the per-request
 * timeout starts when the request is actually sent, not while it waits its
 * turn, so queueing never eats into a job's own timeout budget.
 */
export async function postPrintRequest(
  address: string,
  soap: string,
  timeoutMs: number,
  signal?: AbortSignal,
  fetchImpl?: FetchLike
): Promise<PrintServiceResponse> {
  // Before queueing: an address nobody can request is not worth a turn in
  // line behind the printer's real traffic.
  if (!isRequestableUrl(address)) {
    throw new PrintServiceError(0, address, PRINT_SERVICE_ERRORS.ERROR_PARAMETER);
  }

  const previous = inFlightByEndpoint.get(address);

  let markDone!: () => void;
  const done = new Promise<void>((resolve) => {
    markDone = resolve;
  });
  inFlightByEndpoint.set(address, done);

  try {
    if (previous) {
      // Only ordering matters here, the previous caller already got its own
      // result or error.
      await previous.catch(() => undefined);
    }
    return await sendPrintRequest(address, soap, timeoutMs, signal, fetchImpl);
  } finally {
    markDone();
    if (inFlightByEndpoint.get(address) === done) {
      inFlightByEndpoint.delete(address);
    }
  }
}

async function sendPrintRequest(
  address: string,
  soap: string,
  timeoutMs: number,
  signal?: AbortSignal,
  fetchImpl?: FetchLike
): Promise<PrintServiceResponse> {
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  // A rejected fetch looks the same whoever caused it, and the browser won't
  // say more than "Failed to fetch". Remembering that the abort was ours is
  // what separates "nothing answered in the time we gave it" from "the
  // request never got out", which is the whole difference between a printer
  // that is off and an address that names nothing.
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let res: Response;
    try {
      res = await doFetch(address, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT',
          SOAPAction: '""',
        },
        body: soap,
        signal: controller.signal,
      });
    } catch (err) {
      const cause = timedOut ? PRINT_SERVICE_ERRORS.TIMEOUT : PRINT_SERVICE_ERRORS.UNREACHABLE;
      throw new PrintServiceError(0, String(err), cause);
    }

    const text = await res.text();
    if (!res.ok) {
      throw new PrintServiceError(res.status, text);
    }

    // Regex parsing on purpose: no DOMParser: that's a browser-only global,
    // and this transport must run identically in Node (SSR, scripts, API
    // routes). The vendor itself parses this response with the same regexes
    // in its service-probe path (eposdevice.js checkEposPrintService).
    const responseTag = /<response\b[^>]*/.exec(text)?.[0];
    if (!responseTag) {
      throw new PrintServiceError(res.status, text);
    }

    const attr = (name: string): string | null =>
      new RegExp(`${name}\\s*=\\s*"([^"]*)"`).exec(responseTag)?.[1].trim() ?? null;

    return {
      success: /^(1|true)$/.test(attr('success') ?? ''),
      code: attr('code') ?? '',
      status: parseInt(attr('status') ?? '0', 10) || 0,
      battery: parseInt(attr('battery') ?? '0', 10) || 0,
      printjobid: /<printjobid>([^<]*)<\/printjobid>/.exec(text)?.[1] ?? '',
    };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}
