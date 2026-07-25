import type { PrintServiceResponse } from 'epos-printer-sdk/http';

/**
 * Catalogue of print outcomes and what to do about each one.
 *
 * The codes come from the `code` table in the official ePOS-Print XML manual
 * (Chapter 4 — XML for Controlling Printer), plus ERROR_DEVICE_BUSY, which is
 * the mapping the SDK applies over the firmware's EX_ENPC_TIMEOUT.
 */

/** What the app should do about a result. */
export type RecoveryKind =
  /** Nothing to do: it worked. */
  | 'none'
  /** Retry automatically: the printer was busy or saturated. */
  | 'retry'
  /** Someone has to touch the printer (paper, cover, jam). */
  | 'operator'
  /** Recoverable in software: recover() / reset(). */
  | 'recover'
  /** App or configuration bug: retrying changes nothing. */
  | 'fatal';

export interface Outcome {
  code: string;
  /** One-line explanation, written for whoever operates the app. */
  meaning: string;
  kind: RecoveryKind;
  /** The concrete recommended action. */
  action: string;
}

const OUTCOMES: Outcome[] = [
  // --- Success -----------------------------------------------------------
  {
    code: 'OK',
    meaning: 'The job printed successfully.',
    kind: 'none',
    action: 'Carry on. If you passed a printjobid, you can consider it closed.',
  },

  // --- Retryable (contention between clients) ----------------------------
  {
    code: 'ERROR_DEVICE_BUSY',
    meaning: 'The printer was busy with another job (firmware EX_ENPC_TIMEOUT).',
    kind: 'retry',
    action: 'Retry with backoff (500ms, 1s, 2s). This is the normal case with several clients printing at once.',
  },
  {
    code: 'TooManyRequests',
    meaning: 'More simultaneous jobs than the printer accepts.',
    kind: 'retry',
    action: 'Retry with a longer backoff (2s+). If it happens often, queue jobs in a backend.',
  },
  {
    code: 'EX_SPOOLER',
    meaning: "The printer's spool queue is full.",
    kind: 'retry',
    action: 'Wait and retry. If it persists, check for a job stuck in the printer.',
  },
  {
    code: 'JobSpooling',
    meaning: 'The job is queued and has not finished printing yet.',
    kind: 'retry',
    action: 'Not an error: poll getPrintJobStatus(printjobid) until it confirms.',
  },
  {
    code: 'Printing',
    meaning: 'The printer is printing right now.',
    kind: 'retry',
    action: 'Not an error: poll getPrintJobStatus(printjobid) until it confirms.',
  },
  {
    code: 'EX_TIMEOUT',
    meaning: 'Print timeout.',
    kind: 'retry',
    action: 'Retry. If it repeats, check the network and the printer itself.',
  },

  // --- Needs a person ----------------------------------------------------
  {
    code: 'EPTR_REC_EMPTY',
    meaning: 'Out of paper.',
    kind: 'operator',
    action: 'Ask the operator to load paper. Retry only once the status reports paper: "ok".',
  },
  {
    code: 'EPTR_COVER_OPEN',
    meaning: 'The cover is open.',
    kind: 'operator',
    action: 'Ask for the cover to be closed. Retry when coverOpen is false.',
  },
  {
    code: 'EPTR_BATTERY_LOW',
    meaning: 'The battery has run out (portable models).',
    kind: 'operator',
    action: 'Ask for the printer to be plugged in.',
  },
  {
    code: 'EPTR_CUTTER',
    meaning: 'Auto-cutter error — usually jammed paper.',
    kind: 'operator',
    action: 'Ask for the cutter to be cleared, then call recover() to re-enable printing.',
  },
  {
    code: 'EPTR_MECHANICAL',
    meaning: 'Mechanical error (jammed carriage, etc.).',
    kind: 'operator',
    action: 'Needs physical attention. Once cleared, call recover().',
  },
  {
    code: 'ERROR_WAIT_EJECT',
    meaning: 'The printer is waiting for the printed paper to be removed.',
    kind: 'operator',
    action: 'Ask for the paper to be taken. The next job goes out once it is clear.',
  },

  // --- Recoverable in software -------------------------------------------
  {
    code: 'EPTR_AUTOMATICAL',
    meaning: 'Error with automatic recovery available.',
    kind: 'recover',
    action: 'Call recover() and retry the job.',
  },
  {
    code: 'EPTR_UNRECOVERABLE',
    meaning: 'Unrecoverable error — normally needs a power cycle.',
    kind: 'operator',
    action: 'Ask for the printer to be restarted. recover() is not enough here.',
  },

  // --- App / configuration errors ----------------------------------------
  {
    code: 'SchemaError',
    meaning: 'The XML sent has a syntax error.',
    kind: 'fatal',
    action: 'App bug: check the data passed to the add*() methods. Retrying will not help.',
  },
  {
    code: 'DeviceNotFound',
    meaning: 'No printer exists with that devid.',
    kind: 'fatal',
    action: 'Check the deviceId (default "local_printer") against the printer configuration.',
  },
  {
    code: 'PrintSystemError',
    meaning: 'Print system error.',
    kind: 'fatal',
    action: 'Check the printer. If it persists, restart it.',
  },
  {
    code: 'EX_BADPORT',
    meaning: 'Error on the communication port with the device.',
    kind: 'fatal',
    action: "Check the printer's physical/network connection.",
  },
  {
    code: 'JobNotFound',
    meaning: 'The printjobid queried does not exist.',
    kind: 'fatal',
    action: 'Check the id matches the one used to print. Old ids expire.',
  },
  {
    code: 'RequestEntityTooLarge',
    meaning: "The job exceeds the printer's capacity.",
    kind: 'fatal',
    action: 'Make it smaller (smaller image, less content) and split it into several jobs.',
  },
];

const BY_CODE = new Map(OUTCOMES.map((o) => [o.code, o]));

export const ALL_OUTCOMES = OUTCOMES;

/** Translates a printer response into the outcome and its recommended action. */
export function explainResponse(res: PrintServiceResponse): Outcome {
  if (res.success) {
    return BY_CODE.get('OK')!;
  }
  const known = res.code ? BY_CODE.get(res.code) : undefined;
  if (known) {
    return known;
  }
  return {
    code: res.code || '(no code)',
    meaning: 'The printer rejected the job with a code that is not catalogued.',
    kind: 'fatal',
    action: 'Check the code against the ePOS-Print XML manual and the printer status.',
  };
}

/**
 * Translates an exception (we never reached the printer: network down, wrong
 * host, CORS, timeout) into the same shape.
 */
export function explainError(err: unknown): Outcome {
  const message = err instanceof Error ? err.message : String(err);
  return {
    code: 'NO_RESPONSE',
    meaning: `Could not reach the printer: ${message}`,
    kind: 'retry',
    action:
      'Check network, address and HTTPS. Retry with backoff: the job may never have arrived, so retrying is safe unless it already printed.',
  };
}

export const KIND_LABEL: Record<RecoveryKind, string> = {
  none: 'OK',
  retry: 'Retryable',
  operator: 'Needs operator',
  recover: 'Software recoverable',
  fatal: 'App/config error',
};
