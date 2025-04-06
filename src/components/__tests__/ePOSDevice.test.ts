import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ePOSDevice } from '../ePOSDevice';
import { RESULTS } from '../../constants/results';
// import { Socket } from 'socket.io-client';

describe('ePOSDevice Integration', () => {
  let device: ePOSDevice;

  beforeEach(() => {
    device = new ePOSDevice();
  });

  afterEach(() => {
    device.disconnect();
    vi.restoreAllMocks();
  });

  it('connect to printer web service - success', async () => {
    const testAddress = process.env.PRINTER_ADDRESS || '192.168.0.3';
    const testPort = parseInt(process.env.PRINTER_PORT || '8043');
  
    const result = await device.connect(testAddress, testPort, { eposprint: true });
    expect(result).toBe(RESULTS.OK);
    expect(device.isConnected()).toBe(true);
  });

  it('connect to printer web service - error', async () => {
    const testAddress = process.env.PRINTER_ADDRESS || '192.168.0.3';
    const testPort = parseInt(process.env.PRINTER_PORT || '8043');

    const result = await device.connect(testAddress, testPort, { eposprint: true });
    expect(result).toBe(RESULTS.ERROR);
    expect(device.isConnected()).toBe(false);
  });

  // it('connect to printer socket - success', async () => {
    // const testAddress = process.env.PRINTER_ADDRESS || '192.168.0.3';
    // const testPort = parseInt(process.env.PRINTER_PORT || '8043');
    // const socketEventSpy = vi.spyOn(Socket.prototype, 'on')
    // debugger;
    // await device.connect(testAddress, testPort, { eposprint: false });
    // await vi.waitFor(() => expect(socketEventSpy).toHaveBeenCalledWith('message'), { timeout: 10000 });
    // expect(device.isConnected()).toBe(true);
    // expect(device.getLocation()).toBeDefined();
  // });

  // it('connect to printer socket - error', async () => {
  //   const wrongAddress = 'wrong-printer-address.app';
  //   const testPort = parseInt(process.env.PRINTER_PORT || '8043');
  //   const socketEventSpy = vi.spyOn(Socket.prototype, 'on')
  //   debugger;
  //   const result = await device.connect(wrongAddress, testPort, { eposprint: false });
  //   expect(result).toBe(RESULTS.ERROR);
  //   expect(device.isConnected()).toBe(false);
  //   expect(device.getLocation()).toBeUndefined();
  //   expect(socketEventSpy).not.toHaveBeenCalled();
  // });

  // it('create device - success', () => {
  //   const deviceId = 'test-device';
  //   const deviceType = 'printer';
  //   const deviceOptions = { crypto: false, buffer: false };
  //   const deviceCallback = vi.fn();
  //   const result = await device.createDevice(deviceId, deviceType, deviceOptions, deviceCallback);
  //   expect(result).toBe(RESULTS.OK);
  // });
}); 