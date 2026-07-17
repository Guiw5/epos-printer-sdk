import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { RESULT_OK } from '../../constants/devices';
import { readFileSync } from 'fs';
import path from 'path';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    epson: any;
  }
}

// Hardware integration test: exercises the original vendor SDK against a
// real printer. Skipped unless PRINTER_ADDRESS is set so `pnpm test` stays
// runnable on machines with no printer on the network (e.g. CI).
const PRINTER_ADDRESS = process.env.PRINTER_ADDRESS;
const PRINTER_PORT = 8008;

describe.skipIf(!PRINTER_ADDRESS)('EPSON ePOS SDK Direct Tests', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let epos: any;

  beforeAll(() => {
    const iifePath = path.resolve(__dirname, '../../../sdk/epos.2.27.0.js');
    const code = readFileSync(iifePath, 'utf-8');
    new Function(code)(); // ejecuta la IIFE en globalThis
  });

  beforeEach(() => {
    if (epos) {
      epos.disconnect();
    }
  });

  afterEach(() => {
    if (epos) {
      epos.disconnect();
    }
  });

  it('should connect to printer using SDK directly', async () => {
    epos = new window.epson.ePOSDevice();
    const result = await new Promise<string>((resolve) => {
      epos.connect(PRINTER_ADDRESS, PRINTER_PORT, resolve);
    });
    expect(result).toBe(RESULT_OK);
  });
});
