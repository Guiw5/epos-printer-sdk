export class ePosDeviceMessage {
  public REQUEST = {
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

  public request: string | null = null;
  public sequence: number = 0;
  public deviceId: string = '';
  public serviceId: string = '';
  public data: any = {};
  public isCrypto: string = '0';
  public code: string = '';
  public data_id: number = 0;

  constructor() {}

  public toTransmissionForm(): any[] | null {
    let message: any[] | null = null;
    switch (this.request) {
      case this.REQUEST.PUBKEY:
      case this.REQUEST.ADMININFO:
      case this.REQUEST.RECONNECT:
      case this.REQUEST.DISCONNECT:
        message = [this.request, this.data];
        break;
      case this.REQUEST.OPENDEVICE:
      case this.REQUEST.CLOSEDEVICE:
        message = [this.request, this.deviceId, this.data, this.data_id];
        break;
      case this.REQUEST.DEVICEDATA:
        message = [this.request, this.sequence, this.deviceId, this.data, this.data_id];
        break;
      case this.REQUEST.SERVICEDATA:
        message = [this.request, this.sequence, this.serviceId, this.isCrypto, this.data, this.data_id];
        break;
      case this.REQUEST.OPENCOMMBOX:
      case this.REQUEST.CLOSECOMMBOX:
      case this.REQUEST.COMMDATA:
        message = [this.request, this.sequence, this.data, this.data_id];
        break;
      default:
        message = null;
    }
    return message;
  }
}
