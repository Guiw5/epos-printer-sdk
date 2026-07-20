// Shared HTTP transport for the ePOS-Print web service. Used by ePOSPrint
// (status polling / job status queries) and Printer (printing + monitoring)
// so the request/response plumbing only lives in one place.

export interface PrintServiceResponse {
  success: boolean;
  code: string;
  status: number;
  battery: number;
  printjobid: string;
}

/** Thrown when the print service can't be reached or replies with something we can't parse. */
export class PrintServiceError extends Error {
  constructor(public readonly status: number, public readonly responseText: string) {
    super(`ePOS print service error (status ${status})`);
  }
}

export function buildSoapEnvelope(body: string, printjobid?: string): string {
  const header = printjobid
    ? `<s:Header><parameter xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><printjobid>${printjobid}</printjobid></parameter></s:Header>`
    : '';
  return `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">${header}<s:Body>${body}</s:Body></s:Envelope>`;
}

/**
 * POSTs a SOAP-wrapped ePOS-Print request and parses the <response> element
 * back into a plain object. Rejects with PrintServiceError on network
 * failure, timeout, a non-200 response, or a response with no <response>
 * element to parse.
 */
export async function postPrintRequest(
  address: string,
  soap: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<PrintServiceResponse> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(address, {
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
      throw new PrintServiceError(0, String(err));
    }

    const text = await res.text();
    if (!res.ok) {
      throw new PrintServiceError(res.status, text);
    }

    // Regex parsing on purpose — no DOMParser: that's a browser-only global,
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
