/**
 * Why a request to a printer succeeded or failed. One vocabulary for the whole
 * package: this is what an interface probe reports, what
 * `ePOSDevice.connect()` resolves with, and what `PrintServiceError.code`
 * carries. A code means the same thing whichever of the three produced it.
 *
 * - `OK` / `SSL_CONNECT_OK`: connected (the latter only over https).
 * - `TIMEOUT`: nothing answered before the timeout ran out. Costs the full
 *   wait, and means the printer is off, unplugged, or at a dead address.
 * - `UNREACHABLE`: the request never got out. Fails in milliseconds: a name
 *   that doesn't resolve, a refused connection, TLS or CORS. In a browser
 *   these are indistinguishable from each other, so this is the strongest
 *   thing that can be said without guessing.
 * - `ERROR`: something answered, but not with anything usable.
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
  UNREACHABLE: "UNREACHABLE",
  NONE: "NONE",
} as const

export const ERRORS = {
  ERROR_TIMEOUT: "ERROR_TIMEOUT",
  ERROR_PARAMETER: "ERROR_PARAMETER",
  ERROR_SYSTEM: "SYSTEM_ERROR",
} as const

/**
 * The subset of {@link RESULTS} a failed HTTP request can report, carried by
 * `PrintServiceError.code` so a caller can branch on the cause instead of
 * reading the message. Every value is taken from the vocabulary above, not
 * redefined: the same string always means the same thing.
 */
export const PRINT_SERVICE_ERRORS = {
  TIMEOUT: RESULTS.TIMEOUT,
  UNREACHABLE: RESULTS.UNREACHABLE,
  ERROR: RESULTS.ERROR,
  ERROR_PARAMETER: ERRORS.ERROR_PARAMETER,
} as const

export type PrintServiceErrorCode = (typeof PRINT_SERVICE_ERRORS)[keyof typeof PRINT_SERVICE_ERRORS]

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
