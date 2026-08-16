// Automatic Status Back (ASB) bits, the printer's status word: what
// `send()`/`getPrintJobStatus()` return as `status`, and what the monitoring
// loop diffs to decide which callback to fire.
export const ASB_NO_RESPONSE = 1;
export const ASB_PRINT_SUCCESS = 2;
export const ASB_DRAWER_KICK = 4;
export const ASB_BATTERY_OFFLINE = 4;
export const ASB_OFF_LINE = 8;
export const ASB_COVER_OPEN = 32;
export const ASB_PAPER_FEED = 64;
export const ASB_WAIT_ON_LINE = 256;
export const ASB_PANEL_SWITCH = 512;
export const ASB_MECHANICAL_ERR = 1024;
export const ASB_AUTOCUTTER_ERR = 2048;
export const ASB_UNRECOVER_ERR = 8192;
export const ASB_AUTORECOVER_ERR = 16384;
export const ASB_RECEIPT_NEAR_END = 131072;
export const ASB_RECEIPT_END = 524288;
export const ASB_BUZZER = 16777216;
export const ASB_WAIT_REMOVE_LABEL = 16777216;
export const ASB_NO_LABEL = 67108864;
export const ASB_SPOOLER_IS_STOPPED = 2147483648;
export const DRAWER_OPEN_LEVEL_LOW = 0;
export const DRAWER_OPEN_LEVEL_HIGH = 1;
