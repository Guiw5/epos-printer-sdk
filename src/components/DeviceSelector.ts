import { Connection } from "./Connection";
import type { DeviceType, IDevice } from "../types";
import { ERRORS, NAMES } from "../constants/devices";
import { loadNamedClass } from "../commons/utils";
import type { ePOSDevice } from "./ePOSDevice";

export class DeviceSelector {
  private connection: Connection | null = null;
  private contextDevices: string[] = ['Printer', 'Display', 'HybridPrinter', 'HybridPrinter2'];
  public setConnection(connection: Connection): void {
    this.connection = connection;
  }

  public isSelectable(deviceType: DeviceType): boolean {
    if (this.connection?.isUsableDeviceIF()) {
      return true;
    } else if (deviceType === 'type_printer' && this.connection?.isUsablePrintIF()) {
      return true;
    } else if (deviceType === 'type_display' && this.connection?.isUsableDisplayIF()) {
      return true;
    }
    return false;
  }

  public async select(
    deviceId: string, 
    deviceType: DeviceType, 
    specificDevice?: string, 
    isCrypto: boolean = false, 
    ePOSDevice?: ePOSDevice
  ): Promise<IDevice> {    
    
    let name = specificDevice ?? NAMES[deviceType];
    const deviceClass = await loadNamedClass(name);

    if (typeof deviceClass !== "function") {
      throw new Error(ERRORS.ERROR_DEVICE_NOT_SUPPORTED);
    }
    
    if (this.contextDevices.includes(deviceClass.name)) {
      return new deviceClass(deviceId, isCrypto, ePOSDevice);
    } else {
      return new deviceClass(deviceId, isCrypto);
    }
  }
}
