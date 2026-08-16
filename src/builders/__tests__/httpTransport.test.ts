import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSoapEnvelope, postPrintRequest, PrintServiceError } from '../httpTransport';
import { PRINT_SERVICE_ERRORS } from '../../constants/connection';

function fakeResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

const SUCCESS_XML =
  '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
  '<response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" success="true" code="" status="0" battery="0">' +
  '<printjobid>job-1</printjobid></response></s:Body></s:Envelope>';

describe('buildSoapEnvelope', () => {
  it('wraps the body in a SOAP envelope with no header when no printjobid is given', () => {
    const soap = buildSoapEnvelope('<epos-print/>');
    expect(soap).toBe(
      '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-print/></s:Body></s:Envelope>'
    );
  });

  it('includes a printjobid header when one is given', () => {
    const soap = buildSoapEnvelope('<epos-print/>', 'job-42');
    expect(soap).toContain('<printjobid>job-42</printjobid>');
    expect(soap).toContain('<s:Body><epos-print/></s:Body>');
  });
});

describe('postPrintRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a successful <response> into a PrintServiceResponse', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, SUCCESS_XML));

    const result = await postPrintRequest('https://printer.example/service.cgi', '<soap/>', 5000);

    expect(result).toEqual({
      success: true,
      code: '',
      status: 0,
      battery: 0,
      printjobid: 'job-1',
    });
  });

  it('sends the expected method/headers/body', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, SUCCESS_XML));

    await postPrintRequest('https://printer.example/service.cgi', '<soap-body/>', 5000);

    expect(fetch).toHaveBeenCalledWith(
      'https://printer.example/service.cgi',
      expect.objectContaining({
        method: 'POST',
        body: '<soap-body/>',
        headers: expect.objectContaining({
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '""',
        }),
      })
    );
  });

  it('rejects with PrintServiceError on a non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(500, 'Internal Server Error'));

    await expect(postPrintRequest('https://printer.example', '<soap/>', 5000)).rejects.toMatchObject({
      status: 500,
      responseText: 'Internal Server Error',
    });
  });

  it('rejects with PrintServiceError when the response has no <response> element', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, '<html>not soap</html>'));

    await expect(postPrintRequest('https://printer.example', '<soap/>', 5000)).rejects.toBeInstanceOf(PrintServiceError);
  });

  it('rejects with PrintServiceError(0, ...) on a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await postPrintRequest('https://printer.example', '<soap/>', 5000).catch((e) => e);
    expect(error).toBeInstanceOf(PrintServiceError);
    expect(error.status).toBe(0);
  });

  // A rejected fetch says nothing about who rejected it, so the transport is
  // the only place that still knows whether the abort was its own timeout.
  describe('the cause it classifies the failure into', () => {
    it('is UNREACHABLE when fetch rejects on its own', async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

      const error = await postPrintRequest('https://printer.example', '<soap/>', 5000).catch((e) => e);
      expect(error.code).toBe(PRINT_SERVICE_ERRORS.UNREACHABLE);
    });

    it('is TIMEOUT when nothing answers before the deadline', async () => {
      vi.mocked(fetch).mockImplementation((_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })
      );

      const error = await postPrintRequest('https://printer.example', '<soap/>', 20).catch((e) => e);
      expect(error.code).toBe(PRINT_SERVICE_ERRORS.TIMEOUT);
    });

    it('is ERROR when something answers with something else', async () => {
      vi.mocked(fetch).mockResolvedValue(fakeResponse(500, 'Internal Server Error'));

      const error = await postPrintRequest('https://printer.example', '<soap/>', 5000).catch((e) => e);
      expect(error.code).toBe(PRINT_SERVICE_ERRORS.ERROR);
    });

    // `https:///cgi-bin/...`, which is what an empty printer address builds:
    // URL accepts it and promotes the first path segment to hostname.
    it('is ERROR_PARAMETER for an address that is not requestable, and no request is made', async () => {
      for (const address of ['', 'printer.example', 'https:///cgi-bin/epos/service.cgi']) {
        const error = await postPrintRequest(address, '<soap/>', 5000).catch((e) => e);
        expect({ address, code: error.code }).toEqual({ address, code: PRINT_SERVICE_ERRORS.ERROR_PARAMETER });
      }
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('per-endpoint serialization', () => {
    // Resolves each fetch manually so overlap is observable rather than timed.
    function deferredFetch() {
      const pending: Array<{ url: string; release: () => void }> = [];
      vi.mocked(fetch).mockImplementation((url) =>
        new Promise((resolve) => {
          pending.push({
            url: String(url),
            release: () => resolve(fakeResponse(200, SUCCESS_XML)),
          });
        })
      );
      return pending;
    }

    it('runs one request at a time against the same endpoint', async () => {
      const pending = deferredFetch();

      const first = postPrintRequest('https://printer.example/svc', '<a/>', 5000);
      const second = postPrintRequest('https://printer.example/svc', '<b/>', 5000);

      // The second request must not have reached fetch yet.
      await Promise.resolve();
      expect(pending).toHaveLength(1);

      pending[0].release();
      await first;

      await vi.waitFor(() => expect(pending).toHaveLength(2));
      pending[1].release();
      await expect(second).resolves.toMatchObject({ success: true });
    });

    it('still runs different endpoints in parallel', async () => {
      const pending = deferredFetch();

      const a = postPrintRequest('https://printer-a/svc', '<a/>', 5000);
      const b = postPrintRequest('https://printer-b/svc', '<b/>', 5000);

      await vi.waitFor(() => expect(pending).toHaveLength(2));

      pending[0].release();
      pending[1].release();
      await expect(Promise.all([a, b])).resolves.toHaveLength(2);
    });

    it('a failed request does not wedge the endpoint for the next one', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
      vi.mocked(fetch).mockResolvedValueOnce(fakeResponse(200, SUCCESS_XML));

      await expect(postPrintRequest('https://printer.example/svc', '<a/>', 5000)).rejects.toBeInstanceOf(PrintServiceError);
      await expect(postPrintRequest('https://printer.example/svc', '<b/>', 5000)).resolves.toMatchObject({ success: true });
    });
  });
});
