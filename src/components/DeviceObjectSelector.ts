type DeviceTypes = 'type_scanner' | 'type_keyboard' | 'type_poskeyboard' | 'type_msr' | 'type_cat' | 'type_cash_changer' |
  'type_printer' | 'type_display' | 'type_simple_serial' | 'type_hybrid_printer' | 'type_hybrid_printer2' | 'type_dt' |
  'type_other_peripheral' | 'type_storage';

interface DeviceClasses {
  [key: string]: any;
}

export class DeviceObjectSelector {
  private type2objectMap: { [key in DeviceTypes]: string } = {
    type_scanner: 'Scanner',
    type_keyboard: 'Keyboard',
    type_poskeyboard: 'POSKeyboard',
    type_msr: 'MSR',
    type_cat: 'CAT',
    type_cash_changer: 'CashChanger',
    type_printer: 'Printer',
    type_display: 'Display',
    type_simple_serial: 'SimpleSerial',
    type_hybrid_printer: 'HybridPrinter',
    type_hybrid_printer2: 'HybridPrinter2',
    type_dt: 'DeviceTerminal',
    type_other_peripheral: 'OtherPeripheral',
    type_storage: 'GermanyFiscalElement',
  };

  private connectionObj: any = null;
  private availableDevices: DeviceClasses = {
    //   Printer: Printer,
    //   Display: Display,
    //   HybridPrinter: HybridPrinter,
    //   HybridPrinter2: HybridPrinter2,
    //   Scanner: Scanner,
    //   Keyboard: Keyboard,
    //   POSKeyboard: POSKeyboard,
    //   MSR: MSR,
    //   CAT: CAT,
    //   CashChanger: CashChanger,
    //   SimpleSerial: SimpleSerial,
    //   DeviceTerminal: DeviceTerminal,
    //   OtherPeripheral: OtherPeripheral,
    //   GermanyFiscalElement: GermanyFiscalElement,
  };


  public setConnectionObject(connectionObj: any): void {
    this.connectionObj = connectionObj;
  }

  public isSelectable(deviceType: DeviceTypes): boolean {
    if (this.connectionObj.isUsableDeviceIF()) {
      return true;
    } else if (deviceType === 'type_printer' && this.connectionObj.isUsablePrintIF()) {
      return true;
    } else if (deviceType === 'type_display' && this.connectionObj.isUsableDisplayIF()) {
      return true;
    }
    return false;
  }

  public select(deviceId: string, deviceType: DeviceTypes, specificDevice?: string, isCrypto: boolean = false, ePOSDeviceContext?: any): any {
    let deviceObjectName: string = specificDevice || this.type2objectMap[deviceType];

    const DeviceClass = this.availableDevices[deviceObjectName];
    if (!DeviceClass) {
      throw new Error('ERROR_PARAMETER');
    }

    if (typeof DeviceClass !== 'function') {
      throw new Error('ERROR_PARAMETER');
    }

    // Determinar si se pasa `ePOSDeviceContext` según el tipo de dispositivo
    if (['Printer', 'Display', 'HybridPrinter', 'HybridPrinter2'].includes(deviceObjectName)) {
      return new DeviceClass(deviceId, isCrypto, ePOSDeviceContext);
    } else {
      return new DeviceClass(deviceId, isCrypto);
    }
  }
}
