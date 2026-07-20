import { Connection } from "./Connection";
import type { DeviceType, IDevice } from "../types";
import { NAMES } from "../constants/devices";
import { ERRORS as CONNECTION_ERRORS } from "../constants/connection";
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

    const name = specificDevice ?? NAMES[deviceType];

    // Vendor parity: any load failure surfaces as "ERROR_PARAMETER" — apps
    // switch on that exact code (the vendor's eval-based lookup did the
    // same), so loadNamedClass's internal messages must not leak out.
    let deviceClass;
    try {
      deviceClass = await loadNamedClass(name);
    } catch {
      throw new Error(CONNECTION_ERRORS.ERROR_PARAMETER);
    }
    if (typeof deviceClass !== "function") {
      throw new Error(CONNECTION_ERRORS.ERROR_PARAMETER);
    }

    // Compare against the lookup string, not deviceClass.name — consumer
    // bundlers mangle class names in production, which would silently break
    // the 3-arg constructor path for Printer/Display/HybridPrinter*.
    if (this.contextDevices.includes(name)) {
      return new deviceClass(deviceId, isCrypto, ePOSDevice);
    } else {
      return new deviceClass(deviceId, isCrypto);
    }
  }
}
