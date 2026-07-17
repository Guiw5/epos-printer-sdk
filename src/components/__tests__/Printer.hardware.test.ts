import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ePOSDevice } from '../ePOSDevice';
import type { Printer } from '../../devices/Printer';
import { RESULT_OK } from '../../constants/devices';

// Hardware integration test: prints a real (tiny) receipt on a physical
// printer reachable at PRINTER_ADDRESS. Skipped unless that env var is set —
// this has a real-world side effect (uses paper), so it only runs opt-in.
//
// SAFETY: PRINTER_ADDRESS may point at a production printer shared with
// real operations. Keep this file to read-only / normal-print-job calls
// only (connect, status queries, small print+cut). Never add calls that
// change device configuration, NVRAM/logo storage, CAT financial
// operations, or DeviceTerminal shutdown/restart.
describe.skipIf(!process.env.PRINTER_ADDRESS)('Printer HTTP transport (hardware)', () => {
  let device: ePOSDevice;

  beforeEach(() => {
    device = new ePOSDevice();
  });

  afterEach(() => {
    device.disconnect();
  });

  it('connects, opens a printer device and sends a print job over HTTP', async () => {
    const address = process.env.PRINTER_ADDRESS!;
    const port = parseInt(process.env.PRINTER_PORT || '8043');

    const connectResult = await device.connect(address, port, { eposprint: true });
    expect(connectResult).toBe(RESULT_OK);

    const printer = await new Promise<Printer>((resolve, reject) => {
      device.createDevice('local_printer', 'type_printer', {}, (deviceObject, code) => {
        if (!deviceObject) {
          reject(new Error(`createDevice failed: ${code}`));
          return;
        }
        resolve(deviceObject as Printer);
      });
    });

    const received = await new Promise<{ success: boolean; code: string }>((resolve, reject) => {
      printer.onreceive = (event) => resolve(event);
      printer.onerror = (err) => reject(new Error(JSON.stringify(err)));

      printer
        .addTextAlign(printer.ALIGN_CENTER)
        .addText('epos-printer-v2 hardware test\n')
        .addFeedLine(1)
        .addCut('feed');

      void printer.send();
    });

    expect(received.success).toBe(true);
  }, 15000);
});
