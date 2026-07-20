import { describe, it, expect, afterEach } from 'vitest';
import { ePOSDevice } from '../ePOSDevice';
import type { Printer } from '../../devices/Printer';
import { RESULT_OK, IFPORT_EPOSDEVICE } from '../../constants/devices';

// Hardware test (opt-in via PRINTER_ADDRESS): connects using the SOCKET API
// (no eposprint flag) against a plain TM-T88V — a model that hosts no
// ePOS-Device service (per the official manual, only TM-i/TM-DT/T88VI+ do).
//
// The point is to prove the vendor-faithful graceful degradation: the socket
// transport fails → handleSocketError() probes the HTTP service → connect()
// still resolves "OK" and printing works through checkEposPrintService.
// This transparent fallback is why the socket API *appeared* to work on
// this hardware historically — it was HTTP underneath all along.
//
// SAFETY: production printer — normal print calls only, tiny output.
describe.skipIf(!process.env.PRINTER_ADDRESS)('ePOSDevice socket → HTTP fallback (hardware)', () => {
  let device: ePOSDevice;

  afterEach(() => {
    device.disconnect();
  });

  it('connect() through the socket API resolves OK via the HTTP fallback, and printing works', async () => {
    device = new ePOSDevice();
    const address = process.env.PRINTER_ADDRESS!;

    // Socket path on purpose: port 8008, no { eposprint: true }.
    const result = await device.connect(address, IFPORT_EPOSDEVICE);

    expect(result).toBe(RESULT_OK);
    // Proof the fallback engaged: the instance flipped itself to HTTP mode.
    expect(device.getEposprint()).toBe(true);

    const printer = (await device.createDevice('local_printer', 'type_printer')) as Printer;

    const received = await new Promise<{ success: boolean }>((resolve, reject) => {
      printer.onreceive = (event) => resolve(event);
      printer.onerror = (err) => reject(new Error(JSON.stringify(err)));

      printer
        .addTextAlign(printer.ALIGN_CENTER)
        .addText('socket API -> HTTP fallback OK\n')
        .addFeedLine(1)
        .addCut('feed');

      void printer.send();
    });

    expect(received.success).toBe(true);
  }, 45000);
});
