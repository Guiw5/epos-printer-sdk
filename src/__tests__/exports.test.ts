import { describe, it, expect } from 'vitest';
import * as root from '../index';
import * as http from '../http';
import { ePOSDevice } from '../components/ePOSDevice';
import { EposHttpPrinter } from '../components/EposHttpPrinter';

/** The UPPER_SNAKE properties a class carries for vendor parity. */
function instanceConstants(instance: object): [string, unknown][] {
  return Object.entries(instance).filter(([name]) => /^[A-Z][A-Z0-9_]*$/.test(name));
}

// The constants existed but never left the package: consumers had to retype
// the string literals. These pin the public surface, not the values' origin.
describe('package entry points', () => {
  it('epos-printer-sdk re-exports the builder constants', () => {
    expect(root.CUT_FEED).toBe('feed');
    expect(root.CUT_NO_FEED).toBe('no_feed');
    expect(root.FULL_CUT_FEED).toBe('feed_fullcut');
    expect(root.ALIGN_CENTER).toBe('center');
    expect(root.FONT_A).toBe('font_a');
    expect(root.COLOR_1).toBe('color_1');
    expect(root.MODE_GRAY16).toBe('gray16');
    expect(root.HALFTONE_DITHER).toBe(0);
    expect(root.HALFTONE_THRESHOLD).toBe(2);
    expect(root.LAYOUT_RECEIPT).toBe('receipt');
    expect(root.PULSE_100).toBe('pulse_100');
  });

  it('epos-printer-sdk re-exports the device-management constants', () => {
    expect(root.TYPES.TYPE_PRINTER).toBe('type_printer');
    expect(root.NAMES['type_printer']).toBe('Printer');
    expect(root.ERRORS.ERROR_DEVICE_NOT_FOUND).toBe('DEVICE_NOT_FOUND');
    expect(root.RESULT_OK).toBe('OK');
    expect(root.IFPORT_EPOSDEVICE).toBe(8008);
    expect(root.IFPORT_EPOSDEVICE_S).toBe(8043);
    expect(root.CONNECT_TIMEOUT).toBe(15000);
    expect(root.RECONNECT_TIMEOUT).toBe(3000);
    expect(root.MAX_RECONNECT_RETRY).toBe(5);
  });

  it('epos-printer-sdk/http re-exports the builder constants, and not the device ones', () => {
    expect(http.CUT_FEED).toBe('feed');
    expect(http.ALIGN_RIGHT).toBe('right');
    expect(http.HALFTONE_ERROR_DIFFUSION).toBe(1);
    expect(http.BARCODE_CODE128).toBe('code128');
    expect(Object.keys(http)).not.toContain('IFPORT_EPOSDEVICE');
    expect(Object.keys(http)).not.toContain('TYPES');
  });

  it('ePOSDevice carries the vendor instance constants, so createDevice(id, device.DEVICE_TYPE_PRINTER) works', () => {
    const device = new ePOSDevice();

    expect(device.DEVICE_TYPE_PRINTER).toBe('type_printer');
    expect(device.DEVICE_TYPE_DISPLAY).toBe('type_display');
    expect(device.DEVICE_TYPE_CASH_CHANGER).toBe('type_cash_changer');
    expect(device.DEVICE_TYPE_GFE).toBe('type_storage');
    expect(device.RESULT_OK).toBe('OK');
    expect(device.ERROR_SYSTEM).toBe('SYSTEM_ERROR');
    expect(device.ERROR_PARAMETER).toBe('ERROR_PARAMETER');
    expect(device.ERROR_DEVICE_NOT_FOUND).toBe('DEVICE_NOT_FOUND');
    expect(device.IFPORT_EPOSDEVICE).toBe(8008);
    expect(device.IFPORT_EPOSDEVICE_S).toBe(8043);
    expect(device.CONNECT_TIMEOUT).toBe(15000);
    expect(device.RECONNECT_TIMEOUT).toBe(3000);
    expect(device.MAX_RECONNECT_RETRY).toBe(5);
  });

  it('every DEVICE_TYPE_* instance constant matches the TYPES map it mirrors', () => {
    const device = new ePOSDevice() as unknown as Record<string, string>;
    const mirrored = Object.entries(root.TYPES).map(([key, value]) => [key.replace(/^TYPE_/, 'DEVICE_TYPE_'), value]);

    expect(mirrored).toHaveLength(14);
    for (const [name, value] of mirrored) {
      expect(device[name]).toBe(value);
    }
  });
  // The rule: the module is where a constant lives, and a class carries it as
  // an instance constant only for vendor parity, under the same name. Anything
  // else is a constant that works one way and is `undefined` the other, which
  // is how `printer.CUT_FEED` used to emit `<cut/>` (read as "feed") when the
  // caller asked for no_feed.
  it('every instance constant of the classes you construct yourself is exported under the same name', () => {
    const surface = root as unknown as Record<string, unknown>;

    for (const instance of [new EposHttpPrinter('printer.example.com'), new ePOSDevice()]) {
      const constants = instanceConstants(instance);
      expect(constants.length).toBeGreaterThan(0);

      for (const [name, value] of constants) {
        expect({ name, value: surface[name] }).toEqual({ name, value });
      }
    }
  });

  it('the builder carries the cut constants, so addCut(printer.CUT_NO_FEED) says no_feed', () => {
    const printer = new EposHttpPrinter('printer.example.com');

    expect(printer.CUT_FEED).toBe('feed');
    expect(printer.addCut(printer.CUT_NO_FEED).toString()).toContain('<cut type="no_feed"/>');
  });

  it('epos-printer-sdk exports the connection results ePOSDevice.connect() resolves with', () => {
    expect(root.CONNECT_RESULTS.OK).toBe('OK');
    expect(root.CONNECT_RESULTS.TIMEOUT).toBe('TIMEOUT');
    expect(root.CONNECT_RESULTS.ERROR).toBe('ERROR');
    expect(root.CONNECTION_ERRORS.ERROR_PARAMETER).toBe('ERROR_PARAMETER');
    expect(root.IFPORT_EPOSDEVICE).toBe(8008);
  });

  it('both entry points export the error a failed request rejects with, and the causes it sorts them into', () => {
    for (const entry of [root, http]) {
      expect(entry.PRINT_SERVICE_ERRORS).toEqual({
        TIMEOUT: 'TIMEOUT',
        UNREACHABLE: 'UNREACHABLE',
        ERROR: 'ERROR',
        ERROR_PARAMETER: 'ERROR_PARAMETER',
      });
      expect(new entry.PrintServiceError(0, '')).toBeInstanceOf(Error);
    }
    // Three of the four are the strings the socket path already reports.
    expect(root.PRINT_SERVICE_ERRORS.TIMEOUT).toBe(root.CONNECT_RESULTS.TIMEOUT);
    expect(root.PRINT_SERVICE_ERRORS.ERROR).toBe(root.CONNECT_RESULTS.ERROR);
    expect(root.PRINT_SERVICE_ERRORS.ERROR_PARAMETER).toBe(root.CONNECTION_ERRORS.ERROR_PARAMETER);
  });

  it('both entry points export the ASB status bits', () => {
    expect(root.ASB_COVER_OPEN).toBe(32);
    expect(http.ASB_RECEIPT_END).toBe(524288);
    expect(http.ASB_NO_RESPONSE).toBe(1);
  });
});
