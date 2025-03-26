import type { DeviceCallback, IDevice } from "../types";

export class DeviceElement {
  deviceId: string;
  isCrypto: boolean;  
  deviceObject: IDevice;
  callback: DeviceCallback;

  constructor(deviceId: string, isCrypto: boolean, deviceObject: IDevice, callback: DeviceCallback) {
    this.deviceId = deviceId;
    this.isCrypto = isCrypto;
    this.deviceObject = deviceObject;
    this.callback = callback
  }
}