import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EposHttpPrinter } from '../EposHttpPrinter';

function fakeResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

function statusXml({ success = 'true', status = '0', battery = '0' } = {}): string {
  return (
    '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
    `<response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" success="${success}" code="" status="${status}" battery="${battery}"/>` +
    '</s:Body></s:Envelope>'
  );
}

describe('EposHttpPrinter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds an https address by default and posts to it', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml()));
    const printer = new EposHttpPrinter('printer.example.com');

    await printer.connect();

    expect(fetch).toHaveBeenCalledWith(
      'https://printer.example.com/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000',
      expect.anything()
    );
  });

  it('uses http when port 8008 (IFPORT_EPOSDEVICE) is given', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml()));
    const printer = new EposHttpPrinter('printer.example.com', { port: 8008 });

    await printer.connect();

    expect(fetch).toHaveBeenCalledWith('http://printer.example.com/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000', expect.anything());
  });

  it('connect() resolves when the printer responds online', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml({ status: '0' })));
    const printer = new EposHttpPrinter('printer.example.com');

    await expect(printer.connect()).resolves.toMatchObject({ success: true });
  });

  it('connect() throws when the ASB_NO_RESPONSE bit is set', async () => {
    // ASB_NO_RESPONSE = 1
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml({ status: '1' })));
    const printer = new EposHttpPrinter('printer.example.com');

    await expect(printer.connect()).rejects.toThrow();
  });

  it('send() resolves with the parsed response for a print job', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml({ success: 'true' })));
    const printer = new EposHttpPrinter('printer.example.com');

    const result = await printer.addText('hola\n').addCut('feed').send();

    expect(result.success).toBe(true);
  });

  it('send() with no arguments actually sends what was built via chained add*() calls (regression: used to silently send an empty print body)', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml({ success: 'true' })));
    const printer = new EposHttpPrinter('printer.example.com');

    await printer.addText('barcode data here').addCut('feed').send();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const sentBody = String((init as RequestInit).body);
    expect(sentBody).toContain('<text>barcode data here</text>');
    expect(sentBody).toContain('<cut type="feed"/>');
  });

  it('send() with no built content still behaves as a plain status query', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml({ success: 'true' })));
    const printer = new EposHttpPrinter('printer.example.com');

    await printer.send();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const sentBody = String((init as RequestInit).body);
    expect(sentBody).toContain('<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"></epos-print>');
  });

  it('send() consumes the built content — a second chained print does not resend the first (regression: buffer used to accumulate across sends)', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml({ success: 'true' })));
    const printer = new EposHttpPrinter('printer.example.com');

    await printer.addText('primer ticket').send();
    await printer.addText('segundo ticket').send();

    const [, init2] = vi.mocked(fetch).mock.calls[1];
    const body2 = String((init2 as RequestInit).body);
    expect(body2).toContain('segundo ticket');
    expect(body2).not.toContain('primer ticket');
  });

  it('send() resolves with ERROR_DEVICE_BUSY when the firmware reports EX_ENPC_TIMEOUT (same mapping the legacy onreceive applies)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeResponse(
        200,
        '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
          '<response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" success="false" code="EX_ENPC_TIMEOUT" status="0" battery="0"/>' +
          '</s:Body></s:Envelope>'
      )
    );
    const printer = new EposHttpPrinter('printer.example.com');

    const onreceive = vi.fn();
    printer.onreceive = onreceive;
    const res = await printer.addText('hola\n').send();

    expect(res.success).toBe(false);
    expect(res.code).toBe('ERROR_DEVICE_BUSY');
    expect(onreceive).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERROR_DEVICE_BUSY' }));
  });

  it('send() rejects when the print job fails', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(500, 'boom'));
    const printer = new EposHttpPrinter('printer.example.com');

    await expect(printer.addText('hola\n').send()).rejects.toThrow();
  });
});
