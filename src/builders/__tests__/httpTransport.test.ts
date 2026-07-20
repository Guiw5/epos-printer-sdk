import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSoapEnvelope, postPrintRequest, PrintServiceError } from '../httpTransport';

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
});
