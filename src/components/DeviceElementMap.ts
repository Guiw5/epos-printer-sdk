import { IDevice } from "../types";
import { DeviceElement } from "./DeviceElement";


export class DeviceElementMap {
  private elementMap: Map<string, DeviceElement>;

  constructor() {
    this.elementMap = new Map<string, DeviceElement>();
  }

  add(element: DeviceElement): void {
    this.elementMap.set(element.deviceId, element);
  }

  get(deviceId: string): DeviceElement | null {
    return this.elementMap.get(deviceId) || null;
  }

  getByObj(deviceObject: IDevice): DeviceElement | null {
    for (const element of this.elementMap.values()) {
      if (element.deviceObject === deviceObject) {
        return element;
      }
    }
    return null;
  }

  remove(deviceId: string): void {
    this.elementMap.delete(deviceId);
  }

  removeAll(): void {
    this.elementMap.clear();
  }

  getElementList(): DeviceElement[] {
    return Array.from(this.elementMap.values());
  }
}