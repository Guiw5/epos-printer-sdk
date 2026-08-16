/**
 * What `ePOSDevice.connect()` resolves with, and what an interface probe
 * reports about a single service.
 *
 * - `OK` / `SSL_CONNECT_OK`: connected (the latter only over https).
 * - `TIMEOUT`: nothing answered in time, or the host is unreachable. This is
 *   the printer being off, unplugged, or at another address.
 * - `ERROR`: the service answered, but not with something usable.
 * - `NONE`: no result yet (used internally while probing).
 *
 * A malformed address is reported with `ERRORS.ERROR_PARAMETER` instead: it is
 * the one failure that is about the arguments, not about the printer.
 */
export const RESULTS = {
  OK: "OK",
  SSL_CONNECT_OK: "SSL_CONNECT_OK",
  ERROR: "ERROR",
  TIMEOUT: "TIMEOUT",
  NONE: "NONE",
}

export const ERRORS = {
  ERROR_TIMEOUT: "ERROR_TIMEOUT",
  ERROR_PARAMETER: "ERROR_PARAMETER",
  ERROR_SYSTEM: "SYSTEM_ERROR",
}

export const IF_EPOSDEVICE = 1;
export const IF_EPOSPRINT = 2;
export const IF_EPOSDISPLAY = 4;
export const IF_ALL = 7;
export const CONNECT = 1;
export const DISCONNECT = 2;
export const RECONNECTING = 4;


// Flat twins of the ERRORS map above, the names ePOSDevice carries as instance
// constants.
export const ERROR_SYSTEM = ERRORS.ERROR_SYSTEM;
export const ERROR_PARAMETER = ERRORS.ERROR_PARAMETER;
export const ERROR_TIMEOUT = ERRORS.ERROR_TIMEOUT;
