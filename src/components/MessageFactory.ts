import { ePosDeviceMessage } from './ePosDeviceMessage';
import { ePosCrypto } from './ePosCrypto'; // Suponemos que existe un módulo de criptografía

let sequence: number = 0;
const PUBKEY_TEST_TEXT = 'hello';
const cipher = new ePosCrypto();

const getNextSequence = (): number => {
  sequence++;
  if (sequence === Number.MAX_SAFE_INTEGER) {
    sequence = 1;
  }
  return sequence;
};

export const MessageFactory = {
  parseRequestMessage(message: any[]): ePosDeviceMessage | null {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = message[0];

    switch (eposmsg.request) {
      case eposmsg.REQUEST.CONNECT:
        eposmsg.data = message[1];
        break;
      case eposmsg.REQUEST.PUBKEY:
      case eposmsg.REQUEST.ADMININFO:
      case eposmsg.REQUEST.RECONNECT:
      case eposmsg.REQUEST.DISCONNECT:
        eposmsg.code = message[1];
        eposmsg.data = message[2];
        break;
      case eposmsg.REQUEST.OPENDEVICE:
      case eposmsg.REQUEST.CLOSEDEVICE:
        eposmsg.deviceId = message[1];
        eposmsg.code = message[2];
        eposmsg.data = message[3];
        eposmsg.data_id = message[4];
        break;
      case eposmsg.REQUEST.DEVICEDATA:
        eposmsg.sequence = message[1];
        eposmsg.deviceId = message[2];
        eposmsg.data = message[3];
        eposmsg.data_id = message[4];
        break;
      case eposmsg.REQUEST.SERVICEDATA:
        eposmsg.sequence = message[1];
        eposmsg.serviceId = message[2];
        eposmsg.isCrypto = message[3];
        eposmsg.data = message[4];
        eposmsg.data_id = message[5];
        break;
      case eposmsg.REQUEST.OPENCOMMBOX:
      case eposmsg.REQUEST.CLOSECOMMBOX:
      case eposmsg.REQUEST.COMMDATA:
        eposmsg.sequence = message[1];
        eposmsg.data = message[2];
        eposmsg.data_id = message[3];
        break;
      case eposmsg.REQUEST.ERROR:
        eposmsg.sequence = message[1];
        eposmsg.deviceId = message[2];
        eposmsg.code = message[3];
        eposmsg.data = message[4];
        eposmsg.data_id = message[5];
        break;
      default:
        return null;
    }
    return eposmsg;
  },

  getPubkeyMessage(prime: any, key: any): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = eposmsg.REQUEST.PUBKEY;

    cipher.genClientKeys(prime, key);
    const testData = cipher.bfEncrypt(PUBKEY_TEST_TEXT);
    let pubkey = cipher.pubkey_c.toString(16);

    while (pubkey.length < 192) {
      pubkey = '0' + pubkey;
    }

    eposmsg.data = {
      key: pubkey,
      testData: testData,
    };
    return eposmsg;
  },

  getAdminInfoMessage(): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = eposmsg.REQUEST.ADMININFO;
    eposmsg.data = {};
    return eposmsg;
  },

  getReconnectMessage(prevId: string, curId: string, dataId: number): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = eposmsg.REQUEST.RECONNECT;
    eposmsg.data = {
      old_client_id: prevId,
      new_client_id: curId,
      received_id: dataId,
    };
    return eposmsg;
  },

  getDisconnectMessage(connectionId: string): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = eposmsg.REQUEST.DISCONNECT;
    eposmsg.data = {
      client_id: connectionId,
    };
    return eposmsg;
  },

  getOpenDeviceMessage(deviceId: string, deviceType: string, isCrypto: boolean, isBufferEnable: boolean): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    let deviceTypeName = deviceType;

    if (deviceTypeName === 'type_hybrid_printer2') {
      deviceTypeName = 'type_hybrid_printer';
    }

    eposmsg.request = eposmsg.REQUEST.OPENDEVICE;
    eposmsg.deviceId = deviceId;
    eposmsg.data = {
      type: deviceTypeName,
      crypto: isCrypto,
      buffer: isBufferEnable,
    };

    return eposmsg;
  },

  getCloseDeviceMessage(deviceId: string): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = eposmsg.REQUEST.CLOSEDEVICE;
    eposmsg.deviceId = deviceId;
    eposmsg.data = {};
    return eposmsg;
  },

  getDeviceDataMessage(deviceId: string, data?: any, crypto?: boolean): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = eposmsg.REQUEST.DEVICEDATA;
    eposmsg.sequence = getNextSequence();
    eposmsg.deviceId = deviceId;

    if (crypto) {
      eposmsg.data = cipher.bfEncrypt(JSON.stringify(data));
    } else {
      eposmsg.data = data;
    }

    return eposmsg;
  },

  getServiceMessage(serviceId: string, isCrypt: string, data: any): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = eposmsg.REQUEST.SERVICEDATA;
    eposmsg.sequence = getNextSequence();
    eposmsg.serviceId = serviceId;
    eposmsg.isCrypto = isCrypt;

    if (isCrypt) {
      eposmsg.data = cipher.bfEncrypt(JSON.stringify(data));
    } else {
      eposmsg.data = data;
    }

    return eposmsg;
  },

  getOpenCommBoxMessage(data: any): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = eposmsg.REQUEST.OPENCOMMBOX;
    eposmsg.sequence = getNextSequence();
    eposmsg.data = data;
    return eposmsg;
  },

  getCloseCommBoxMessage(data: any): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = eposmsg.REQUEST.CLOSECOMMBOX;
    eposmsg.sequence = getNextSequence();
    eposmsg.data = data;
    return eposmsg;
  },

  getCommBoxDataMessage(data: any): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = eposmsg.REQUEST.COMMDATA;
    eposmsg.sequence = getNextSequence();
    eposmsg.data = data;
    return eposmsg;
  },

  decrypt(data: string): any {
    const decryptedData = cipher.bfDecrypt(data);
    return JSON.parse(decryptedData);
  },
};
