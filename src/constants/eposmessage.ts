export const REQUEST = {
  CONNECT: 'connect',
  PUBKEY: 'pubkey',
  ADMININFO: 'admin_info',
  RECONNECT: 'reconnect',
  DISCONNECT: 'disconnect',
  OPENDEVICE: 'open_device',
  CLOSEDEVICE: 'close_device',
  DEVICEDATA: 'device_data',
  SERVICEDATA: 'service_data',
  ERROR: 'error',
  OPENCOMMBOX: 'open_commbox',
  CLOSECOMMBOX: 'close_commbox',
  COMMDATA: 'commbox_data',
};

export const CODES = {
  SHARED_KEY_MISMATCH_ERROR: 'SHARED_KEY_MISMATCH_ERROR',
  PARAM_ERROR: 'PARAM_ERROR',
  // The wire value is literally "OK" (vendor: `this.RESULT_OK = "OK"`, and
  // the ePOS-Device XML manual's response tables show <code>OK</code>). It
  // was once 'RESULT_OK' here, which made procAdminInfo/procReconnect/
  // procOpenDevice reject every real success response from the hardware.
  RESULT_OK: 'OK',
};