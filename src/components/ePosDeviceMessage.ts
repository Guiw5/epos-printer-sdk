import { CODES, REQUEST } from "../constants/eposmessage";

export type MsgData = {
  password: string;
  protocol_version: number;
  client_id: string;
  prime: string;
  key: string;
  admin_name: string;
  location: string;
  testData: string;
  old_client_id: string;
  new_client_id: string;
  received_id: number;
  type: string;
  crypto: boolean;
  buffer: boolean;
  printdata: string;
  printjobid: string;
  timeout: number;
  box_id: string;
  member_id: string;
  code: string;
}
export type Data = MsgData | string;

export class ePosDeviceMessage {
  public request: keyof typeof REQUEST | string = '';
  public sequence: number = 0;
  public deviceId: string = '';
  public serviceId: string = '';
  public data: Data = {} as Data;
  public isCrypto: boolean = false;
  public code: keyof typeof CODES | string = '';
  public data_id: number = 0;

  constructor() {}

  public toTransmissionForm(): any[] | null {
    let message: any[] | null = null;
    switch (this.request) {
      case REQUEST.PUBKEY:
      case REQUEST.ADMININFO:
      case REQUEST.RECONNECT:
      case REQUEST.DISCONNECT:
        message = [this.request, this.data];
        break;
      case REQUEST.OPENDEVICE:
      case REQUEST.CLOSEDEVICE:
        message = [this.request, this.deviceId, this.data, this.data_id];
        break;
      case REQUEST.DEVICEDATA:
        message = [this.request, this.sequence, this.deviceId, this.data, this.data_id];
        break;
      case REQUEST.SERVICEDATA:
        message = [this.request, this.sequence, this.serviceId, this.isCrypto, this.data, this.data_id];
        break;
      case REQUEST.OPENCOMMBOX:
      case REQUEST.CLOSECOMMBOX:
      case REQUEST.COMMDATA:
        message = [this.request, this.sequence, this.data, this.data_id];
        break;
      default:
        message = null;
    }
    return message;
  }
}
