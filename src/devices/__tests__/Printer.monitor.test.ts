import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Printer } from '../Printer';
import { Connection } from '../../components/Connection';
import type { ePOSDevice } from '../../components/ePOSDevice';

function fakeResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

function statusXml(status: string): string {
  return (
    '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
    `<response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" success="true" code="" status="${status}" battery="0"/>` +
    '</s:Body></s:Envelope>'
  );
}

function connectedPrinter(): Printer {
  const connection = new Connection();
  connection.setAddress('http', 'printer.example.com', 8008);
  const printer = new Printer('local_printer', false, {} as ePOSDevice);
  printer.setConnection(connection);
  return printer;
}

// The polling loop moved up to ePOSPrint; Printer keeps only the address it
// derives from the device connection, and its own status-diff sentinel.
describe('Printer monitoring after the move to ePOSPrint', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('polls the device endpoint derived from the connection', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml('2')));
    const printer = connectedPrinter();
    const seen: number[] = [];
    printer.onstatuschange = (status) => seen.push(status);

    printer.startMonitor();
    await vi.waitFor(() => expect(seen).toEqual([2]));
    printer.stopMonitor();

    expect(fetch).toHaveBeenCalledWith(
      'http://printer.example.com/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000',
      expect.anything()
    );
  });

  it('stopMonitor() and finalize() both end the poll', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml('2')));
    const printer = connectedPrinter();
    printer.interval = 1000;

    printer.startMonitor();
    await vi.advanceTimersByTimeAsync(2500);
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThanOrEqual(3);

    printer.finalize();
    const afterStop = vi.mocked(fetch).mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(afterStop);
    expect(printer.enabled).toBe(false);
  });

  it('reports the first reading in full, the vendor way (diffed against ASB_DRAWER_KICK)', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeResponse(200, statusXml('2')));
    const printer = connectedPrinter();
    const fired: string[] = [];
    printer.ononline = () => fired.push('online');
    printer.onpaperok = () => fired.push('paperok');
    printer.oncoverok = () => fired.push('coverok');

    printer.startMonitor();
    await vi.waitFor(() => expect(fired).toEqual(['online', 'coverok', 'paperok']));
    printer.stopMonitor();
  });
});
