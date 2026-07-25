import type { PrintServiceResponse } from 'epos-printer-sdk/http';

/**
 * Catálogo de resultados de impresión y qué hacer con cada uno.
 *
 * Los códigos salen de la tabla `code` del manual oficial ePOS-Print XML
 * (Chapter 4 — XML for Controlling Printer), más ERROR_DEVICE_BUSY, que es
 * el mapeo que el SDK aplica sobre EX_ENPC_TIMEOUT del firmware.
 */

/** Qué debería hacer la app ante un resultado. */
export type RecoveryKind =
  /** Nada que hacer: salió bien. */
  | 'none'
  /** Reintentar automáticamente: la impresora estaba ocupada/saturada. */
  | 'retry'
  /** Requiere que una persona toque la impresora (papel, tapa, atasco). */
  | 'operator'
  /** Se puede intentar recuperar por software: recover() / reset(). */
  | 'recover'
  /** Bug de la app o de configuración: reintentar no cambia nada. */
  | 'fatal';

export interface Outcome {
  code: string;
  /** Explicación en una línea, orientada a quien opera la app. */
  meaning: string;
  kind: RecoveryKind;
  /** Acción concreta recomendada. */
  action: string;
}

const OUTCOMES: Outcome[] = [
  // --- Éxito -------------------------------------------------------------
  {
    code: 'OK',
    meaning: 'El trabajo se imprimió correctamente.',
    kind: 'none',
    action: 'Continuar. Si usás printjobid, ya podés darlo por cerrado.',
  },

  // --- Reintentables (contención entre clientes) -------------------------
  {
    code: 'ERROR_DEVICE_BUSY',
    meaning: 'La impresora estaba ocupada con otro trabajo (EX_ENPC_TIMEOUT del firmware).',
    kind: 'retry',
    action: 'Reintentar con backoff (500ms, 1s, 2s). Es el caso típico con varios clientes imprimiendo a la vez.',
  },
  {
    code: 'TooManyRequests',
    meaning: 'Se superó el límite de trabajos simultáneos aceptados por la impresora.',
    kind: 'retry',
    action: 'Reintentar con backoff más largo (2s+). Si es frecuente, encolar los trabajos en un backend.',
  },
  {
    code: 'EX_SPOOLER',
    meaning: 'La cola de impresión de la impresora está llena.',
    kind: 'retry',
    action: 'Esperar y reintentar. Si persiste, revisar si hay un trabajo trabado en la impresora.',
  },
  {
    code: 'JobSpooling',
    meaning: 'El trabajo está en la cola, todavía no terminó de imprimirse.',
    kind: 'retry',
    action: 'No es un error: consultar getPrintJobStatus(printjobid) hasta que confirme.',
  },
  {
    code: 'Printing',
    meaning: 'La impresora está imprimiendo en este momento.',
    kind: 'retry',
    action: 'No es un error: consultar getPrintJobStatus(printjobid) hasta que confirme.',
  },
  {
    code: 'EX_TIMEOUT',
    meaning: 'Timeout de impresión.',
    kind: 'retry',
    action: 'Reintentar. Si se repite, verificar la red y el estado físico de la impresora.',
  },

  // --- Requieren intervención humana -------------------------------------
  {
    code: 'EPTR_REC_EMPTY',
    meaning: 'Se acabó el papel.',
    kind: 'operator',
    action: 'Avisar al operador que cargue papel. Reintentar recién cuando el estado indique paper: "ok".',
  },
  {
    code: 'EPTR_COVER_OPEN',
    meaning: 'La tapa está abierta.',
    kind: 'operator',
    action: 'Avisar que cierre la tapa. Reintentar cuando coverOpen sea false.',
  },
  {
    code: 'EPTR_BATTERY_LOW',
    meaning: 'La batería se agotó (modelos portátiles).',
    kind: 'operator',
    action: 'Avisar que conecte la impresora a la corriente.',
  },
  {
    code: 'EPTR_CUTTER',
    meaning: 'Error del cortador automático — típicamente papel trabado.',
    kind: 'operator',
    action: 'Avisar que destrabe el cortador; después llamar a recover() para volver a habilitar la impresión.',
  },
  {
    code: 'EPTR_MECHANICAL',
    meaning: 'Error mecánico (carro trabado, etc.).',
    kind: 'operator',
    action: 'Requiere revisión física. Después de destrabar, llamar a recover().',
  },
  {
    code: 'ERROR_WAIT_EJECT',
    meaning: 'La impresora espera que se retire el papel impreso.',
    kind: 'operator',
    action: 'Avisar que retire el papel. El siguiente trabajo sale solo cuando se libere.',
  },

  // --- Recuperables por software -----------------------------------------
  {
    code: 'EPTR_AUTOMATICAL',
    meaning: 'Error con recuperación automática disponible.',
    kind: 'recover',
    action: 'Llamar a recover() y reintentar el trabajo.',
  },
  {
    code: 'EPTR_UNRECOVERABLE',
    meaning: 'Error irrecuperable — normalmente requiere apagar y encender la impresora.',
    kind: 'operator',
    action: 'Avisar que reinicie la impresora. recover() no alcanza para este caso.',
  },

  // --- Errores de la app / configuración ---------------------------------
  {
    code: 'SchemaError',
    meaning: 'El XML enviado tiene un error de sintaxis.',
    kind: 'fatal',
    action: 'Bug de la app: revisar los datos que se le pasan a los métodos add*(). Reintentar no sirve.',
  },
  {
    code: 'DeviceNotFound',
    meaning: 'No existe una impresora con ese devid.',
    kind: 'fatal',
    action: 'Revisar el deviceId (por defecto "local_printer") en la configuración de la impresora.',
  },
  {
    code: 'PrintSystemError',
    meaning: 'Error del sistema de impresión.',
    kind: 'fatal',
    action: 'Revisar la impresora. Si persiste, reiniciarla.',
  },
  {
    code: 'EX_BADPORT',
    meaning: 'Error en el puerto de comunicación con el dispositivo.',
    kind: 'fatal',
    action: 'Revisar la conexión física/de red de la impresora.',
  },
  {
    code: 'JobNotFound',
    meaning: 'El printjobid consultado no existe.',
    kind: 'fatal',
    action: 'Verificar que el id sea el mismo que se usó al imprimir. Los ids viejos expiran.',
  },
  {
    code: 'RequestEntityTooLarge',
    meaning: 'El trabajo excede la capacidad de la impresora.',
    kind: 'fatal',
    action: 'Reducir el tamaño (imagen más chica, menos contenido) y dividir en varios trabajos.',
  },
];

const BY_CODE = new Map(OUTCOMES.map((o) => [o.code, o]));

export const ALL_OUTCOMES = OUTCOMES;

/** Traduce una respuesta de la impresora al resultado y su acción recomendada. */
export function explainResponse(res: PrintServiceResponse): Outcome {
  if (res.success) {
    return BY_CODE.get('OK')!;
  }
  const known = res.code ? BY_CODE.get(res.code) : undefined;
  if (known) {
    return known;
  }
  return {
    code: res.code || '(sin código)',
    meaning: 'La impresora rechazó el trabajo con un código no catalogado.',
    kind: 'fatal',
    action: 'Revisar el código contra el manual ePOS-Print XML y el estado de la impresora.',
  };
}

/**
 * Traduce una excepción (no llegamos a hablar con la impresora: red caída,
 * host mal escrito, CORS, timeout) al mismo formato.
 */
export function explainError(err: unknown): Outcome {
  const message = err instanceof Error ? err.message : String(err);
  return {
    code: 'SIN_RESPUESTA',
    meaning: `No se pudo contactar la impresora: ${message}`,
    kind: 'retry',
    action:
      'Verificar red/dirección/HTTPS. Reintentar con backoff: el trabajo puede no haber llegado, así que reintentar es seguro salvo que ya se haya impreso.',
  };
}

export const KIND_LABEL: Record<RecoveryKind, string> = {
  none: 'OK',
  retry: 'Reintentable',
  operator: 'Requiere operador',
  recover: 'Recuperable por software',
  fatal: 'Error de app/config',
};
