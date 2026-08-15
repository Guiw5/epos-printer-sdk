import { ePosDeviceMessage, Data, MsgData } from './ePosDeviceMessage';
import type { ePosCrypto } from './ePosCrypto';
import { REQUEST } from '../constants/eposmessage';

let sequence: number = 0;
const PUBKEY_TEST_TEXT = 'hello';

// Diffie-Hellman + Blowfish + MD5 + bigint is the heaviest thing in the
// package and only the ePOS-Device socket transport ever reaches it, so it is
// loaded on demand, the same way socket.io-client is. loadCrypto() is awaited
// by connectBySocketIo() before any socket handler is registered, which is why
// every consumer of the cipher below can stay synchronous.
let loaded: ePosCrypto | null = null;
let loading: Promise<ePosCrypto> | null = null;

function requireCipher(): ePosCrypto {
  if (!loaded) {
    throw new Error(
      'The ePOS-Device crypto module is not loaded yet. It loads automatically when the socket ' +
      'transport connects, await MessageFactory.loadCrypto() first if you drive the message layer directly.'
    );
  }
  return loaded;
}

const getNextSequence = (): number => {
  sequence++;
  if (sequence === Number.MAX_SAFE_INTEGER) {
    sequence = 1;
  }
  return sequence;
};

export const MessageFactory = {
  /** Loads the crypto stack. Idempotent, and safe to call concurrently. */
  async loadCrypto(): Promise<void> {
    if (loaded) return;
    if (!loading) {
      loading = import('./ePosCrypto').then(({ ePosCrypto }) => new ePosCrypto());
    }
    loaded = await loading;
  },

  parseRequestMessage(message: any[]): ePosDeviceMessage | null {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = message[0];
    switch (eposmsg.request) {
      case REQUEST.CONNECT:
        eposmsg.data = message[1];
        break;
      case REQUEST.PUBKEY:
      case REQUEST.ADMININFO:
      case REQUEST.RECONNECT:
      case REQUEST.DISCONNECT:
        eposmsg.code = message[1];
        eposmsg.data = message[2];
        break;
      case REQUEST.OPENDEVICE:
      case REQUEST.CLOSEDEVICE:
        eposmsg.deviceId = message[1];
        eposmsg.code = message[2];
        eposmsg.data = message[3];
        eposmsg.data_id = message[4];
        break;
      case REQUEST.DEVICEDATA:
        eposmsg.sequence = message[1];
        eposmsg.deviceId = message[2];
        eposmsg.data = message[3];
        eposmsg.data_id = message[4];
        break;
      case REQUEST.SERVICEDATA:
        eposmsg.sequence = message[1];
        eposmsg.serviceId = message[2];
        eposmsg.isCrypto = message[3];
        eposmsg.data = message[4];
        eposmsg.data_id = message[5];
        break;
      case REQUEST.OPENCOMMBOX:
      case REQUEST.CLOSECOMMBOX:
      case REQUEST.COMMDATA:
        eposmsg.sequence = message[1];
        eposmsg.data = message[2];
        eposmsg.data_id = message[3];
        break;
      case REQUEST.ERROR:
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

  getPubkeyMessage(prime: string, key: string): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = REQUEST.PUBKEY;

    const cipher = requireCipher();
    cipher.genClientKeys(prime, key);

    eposmsg.data = {
      key: cipher.getPubkeyHex(),
      testData: cipher.bfEncrypt(PUBKEY_TEST_TEXT),
    } as MsgData;
    return eposmsg;
  },

  getAdminInfoMessage(): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = REQUEST.ADMININFO;
    eposmsg.data = {} as MsgData;
    return eposmsg;
  },

  getReconnectMessage(prevId: string, curId: string, dataId: number): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = REQUEST.RECONNECT;
    eposmsg.data = {
      old_client_id: prevId,
      new_client_id: curId,
      received_id: dataId,
    } as MsgData;
    return eposmsg;
  },

  getDisconnectMessage(connectionId: string): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = REQUEST.DISCONNECT;
    eposmsg.data = {
      client_id: connectionId,
    } as MsgData;
    return eposmsg;
  },

  getOpenDeviceMessage(deviceId: string, deviceType: string, isCrypto: boolean, isBufferEnable: boolean): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    let deviceTypeName = deviceType;

    if (deviceTypeName === 'type_hybrid_printer2') {
      deviceTypeName = 'type_hybrid_printer';
    }

    eposmsg.request = REQUEST.OPENDEVICE;
    eposmsg.deviceId = deviceId;
    eposmsg.data = {
      type: deviceTypeName,
      crypto: isCrypto,
      buffer: isBufferEnable,
    } as MsgData;

    return eposmsg;
  },

  getCloseDeviceMessage(deviceId: string): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = REQUEST.CLOSEDEVICE;
    eposmsg.deviceId = deviceId;
    eposmsg.data = {} as MsgData;
    return eposmsg;
  },

  getDeviceDataMessage(deviceId: string, data: Data, crypto?: boolean): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = REQUEST.DEVICEDATA;
    eposmsg.sequence = getNextSequence();
    eposmsg.deviceId = deviceId;
    eposmsg.data = crypto ? requireCipher().bfEncrypt(JSON.stringify(data)) : data;
    return eposmsg;
  },

  getServiceMessage(serviceId: string, crypto: boolean, data: Data): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = REQUEST.SERVICEDATA;
    eposmsg.sequence = getNextSequence();
    eposmsg.serviceId = serviceId;
    eposmsg.isCrypto = crypto;
    eposmsg.data = crypto ? requireCipher().bfEncrypt(JSON.stringify(data)) : data;
    return eposmsg;
  },

  getOpenCommBoxMessage(data: Data): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = REQUEST.OPENCOMMBOX;
    eposmsg.sequence = getNextSequence();
    eposmsg.data = data;
    return eposmsg;
  },

  getCloseCommBoxMessage(data: Data): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = REQUEST.CLOSECOMMBOX;
    eposmsg.sequence = getNextSequence();
    eposmsg.data = data;
    return eposmsg;
  },

  getCommBoxDataMessage(data: Data): ePosDeviceMessage {
    const eposmsg = new ePosDeviceMessage();
    eposmsg.request = REQUEST.COMMDATA;
    eposmsg.sequence = getNextSequence();
    eposmsg.data = data;
    return eposmsg;
  },

  decrypt(data: string): MsgData {
    const decryptedData = requireCipher().bfDecrypt(data);
    return JSON.parse(decryptedData) as MsgData;
  },
};
