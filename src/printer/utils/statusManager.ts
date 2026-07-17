export interface PrinterResponse {
  success: boolean;
  code: string;
  status: number;
  battery: number;
  printjobid?: string;
}

export interface PrinterEvents {
  onreceive: (event: PrinterResponse) => void;
  onerror: (error: PrinterError) => void;
  onstatuschange: (status: number) => void;
  ononline: () => void;
  onoffline: () => void;
  onpoweroff: () => void;
  oncoverok: () => void;
  oncoveropen: () => void;
  onpaperok: () => void;
  onpaperend: () => void;
  onpapernearend: () => void;
  ondrawerclosed: () => void;
  ondraweropen: () => void;
  onbatterylow: () => void;
  onbatteryok: () => void;
  onbatterystatuschange: (battery: number) => void;
}

export interface PrinterState {
  status: number;
  battery: number;
  drawerOpenLevel: number;
} 


export interface PrinterError {
    code: PrinterErrorCode;
    message: string;
}

// Clase principal
export class PrinterStatusManager {
    private currentState: PrinterState;
    private events: PrinterEvents;

    constructor(events: PrinterEvents, initialState: PrinterState) {
        this.events = events;
        this.currentState = initialState;
    }

    updateState(newStatus: number, newBattery: number): void {
        const oldStatus = this.currentState.status;
        const oldBattery = this.currentState.battery;

        // Calcular diferencias
        const statusChange = oldStatus === 0 ? ~0 : oldStatus ^ newStatus;
        const batteryChange = oldBattery === 0 ? ~0 : oldBattery ^ newBattery;

        // Actualizar estado
        this.currentState.status = newStatus;
        this.currentState.battery = newBattery;

        // Manejar cambios de batería
        if (batteryChange) {
          this.events.onbatterystatuschange?.(newBattery);
        }

        // Notificar cambios
        if (statusChange) {
          this.handleChanges(statusChange, newStatus);
        }
    }

    private handleChanges(statusChange: number, newStatus: number): void {
        // Notificar cambio general de estado
        if (this.events.onstatuschange) {
            this.events.onstatuschange(newStatus);
        }

        // Manejar cambios de conexión
        if (statusChange & (PrinterStatus.NO_RESPONSE | PrinterStatus.OFF_LINE)) {
            if (newStatus & PrinterStatus.NO_RESPONSE) {
                this.events.onpoweroff?.();
            } else if (newStatus & PrinterStatus.OFF_LINE) {
                this.events.onoffline?.();
            } else {
                this.events.ononline?.();
            }
        }

        // Manejar cambios de tapa
        if (statusChange & PrinterStatus.COVER_OPEN) {
            if (newStatus & PrinterStatus.COVER_OPEN) {
                this.events.oncoveropen?.();
            } else {
                this.events.oncoverok?.();
            }
        }

        // Manejar cambios de papel
        if (statusChange & (PrinterStatus.RECEIPT_END | PrinterStatus.RECEIPT_NEAR_END)) {
            if (newStatus & PrinterStatus.RECEIPT_END) {
                this.events.onpaperend?.();
            } else if (newStatus & PrinterStatus.RECEIPT_NEAR_END) {
                this.events.onpapernearend?.();
            } else {
                this.events.onpaperok?.();
            }
        }

        // Manejar cambios de cajón
        if (statusChange & PrinterStatus.DRAWER_KICK) {
            if (newStatus & PrinterStatus.DRAWER_KICK) {
                if (this.currentState.drawerOpenLevel === 1) {
                    this.events.ondraweropen?.();
                } else {
                    this.events.ondrawerclosed?.();
                }
            } else {
                if (this.currentState.drawerOpenLevel === 1) {
                    this.events.ondrawerclosed?.();
                } else {
                    this.events.ondraweropen?.();
                }
            }
        }
    }

    getState(): PrinterState {
        return { ...this.currentState };
    }
} 


export enum PrinterStatus {
  // Estados de conexión
  NO_RESPONSE = 1,           // La impresora no responde
  PRINT_SUCCESS = 2,
  DRAWER_KICK = 4,           // El cajón está abierto
  BATTERY_OFFLINE = 4,
  OFF_LINE = 8,              // La impresora está offline
  
  // Estados de la tapa
  COVER_OPEN = 32,           // La tapa está abierta
  
  // Estados del papel
  PAPER_FEED = 64,           // El papel se está alimentando
  RECEIPT_NEAR_END = 131072, // Poco papel
  RECEIPT_END = 524288,      // Sin papel
  
  // Estados del cajón
  WAIT_ON_LINE = 256,        // Esperando volver online
  PANEL_SWITCH = 512,        // Interruptor del panel presionado
  MECHANICAL_ERR = 1024,     // Error mecánico
  AUTOCUTTER_ERR = 2048,     // Error del autocortador
  UNRECOVER_ERR = 8192,      // Error no recuperable
  AUTORECOVER_ERR = 16384,   // Error recuperable automáticamente
  BUZZER = 16777216,         // Zumbador activo
  WAIT_REMOVE_LABEL = 16777216,
  NO_LABEL = 67108864,       // Sin etiqueta
  SPOOLER_IS_STOPPED = 2147483648 // Spooler detenido
}

export enum PrinterErrorCode {
  SUCCESS = 'SUCCESS',
  EPTR_AUTOMATICAL = 'EPTR_AUTOMATICAL',      // Error recuperable automáticamente
  EPTR_COVER_OPEN = 'EPTR_COVER_OPEN',        // Tapa abierta
  EPTR_CUTTER = 'EPTR_CUTTER',                // Error del autocortador
  EPTR_MECHANICAL = 'EPTR_MECHANICAL',        // Error mecánico
  EPTR_REC_EMPTY = 'EPTR_REC_EMPTY',          // Sin papel
  EPTR_UNRECOVERABLE = 'EPTR_UNRECOVERABLE',  // Error no recuperable
  EPTR_SCHEMAERROR = 'EPTR_SCHEMAERROR',      // Error de sintaxis
  ERROR_DEVICE_NOT_FOUND = 'ERROR_DEVICE_NOT_FOUND', // Dispositivo no encontrado
  ERROR_DEVICE_BUSY = 'ERROR_DEVICE_BUSY',    // Dispositivo ocupado
  ERROR_TIMEOUT = 'ERROR_TIMEOUT',            // Tiempo de espera agotado
  ERROR_PARAMETER = 'ERROR_PARAMETER',        // Error de parámetro
  ERROR_NOT_SUPPORTED = 'ERROR_NOT_SUPPORTED' // No soportado
}

export enum DrawerOpenLevel {
  LOW = 0,
  HIGH = 1
} 
