// src/components/EPOSDevice.ts

import { MessageFactory } from './MessageFactory';
import { Connection } from './Connection';
import { CommBoxManager } from './CommBoxManager';
import { DeviceSelector } from './DeviceSelector';
import { Ofsc } from './Ofsc';
import { CookieIO } from './CookieIO';
import { SocketGarbageBox } from './SocketGarbageBox';
import type { DeviceCallback, DeviceType, LegacySocket } from '../types';
import { 
  RESULTS,
  ERRORS as CONNECTION_ERRORS,
  IF_EPOSDEVICE,
  DISCONNECT,
  IF_EPOSPRINT, 
  CONNECT,
  RECONNECTING,
  IF_ALL,
} from '../constants/connection';
import { 
  CONNECT_TIMEOUT,
  TYPES,
  IFPORT_EPOSDEVICE,
  RESULT_OK,
  ERRORS as DEVICE_ERRORS,
  ERRORS,
  MAX_RECONNECT_RETRY,
  RECONNECT_TIMEOUT
} from '../constants/devices';
import { ePosDeviceMessage, MsgData } from './ePosDeviceMessage';
import { CODES, REQUEST } from '../constants/eposmessage';
import { DeviceElementMap } from './DeviceElementMap';
import { DeviceElement } from './DeviceElement';
import type { IDevice } from '../types';

import { postPrintRequest } from '../builders/httpTransport';

interface DeviceOptions {
  crypto?: boolean;
  buffer?: boolean;
  driver?: string;
  eposprint?: boolean;
}

interface ConnectionOptions {
  eposprint?: boolean;
}

export class ePOSDevice {
  // Private members
  private socket: LegacySocket | null = null;
  private connectionId: string | null = null;
  private reconnectTimerId: number | NodeJS.Timeout = 0;
  private reconnectTryCount = 0;
  private admin = "";
  private location = "";
  private recievedDataId = 0;
  private connectStartTime = 0;
  private waitRetryConnectId: number | NodeJS.Timeout = 0;
  private eposprint = false;
  private cbCheckEposPrintService: ((result: string) => void) | null = null;

  // Utility objects
  private readonly conection: Connection;
  private readonly commBoxManager: CommBoxManager;
  private readonly devSelector: DeviceSelector;
  private readonly deviceIntances: DeviceElementMap;
  private readonly ofsc: Ofsc;
  private readonly cookieIo: CookieIO;
  private readonly gbox: SocketGarbageBox;

  // Event handlers
  public onreconnect?: () => void;
  public onreconnecting?: () => void;
  public ondisconnect?: () => void;
  public onerror?: (sequence: string, deviceId: string, error: string, data: any) => void;

  constructor() {
    this.conection = new Connection();
    this.commBoxManager = new CommBoxManager();
    this.commBoxManager.setConnection(this.conection);
    this.devSelector = new DeviceSelector();
    this.devSelector.setConnection(this.conection);
    this.deviceIntances = new DeviceElementMap();
    this.ofsc = new Ofsc();
    this.ofsc.setConnection(this.conection);
    this.cookieIo = new CookieIO();
    this.gbox = new SocketGarbageBox();

    if (typeof window !== 'undefined') {
      window.onbeforeunload = () => {
        this.disconnect();
      };
      window.onpagehide = () => {
        this.disconnect();
      };
    }
  }

  getEposprint(): boolean {
    return this.eposprint;
  }

  async connect(address: string, port: number, options?: ConnectionOptions): Promise<string> {
    try {
      if (
        this.conection.status(IF_EPOSDEVICE) !== DISCONNECT || 
        this.conection.status(IF_EPOSPRINT) !== DISCONNECT
      ) {
        this.disconnect();
      }

      this.connectStartTime = new Date().getTime();
      const protocol = port === IFPORT_EPOSDEVICE ? "http" : "https";
      this.conection.setAddress(protocol, address, port);
      this.eposprint = options?.eposprint ?? false;

      if (this.eposprint) {
        console.log('connecting web service');
        await this.conection.probeWebServiceIF();
        console.log('connected web service', this.conection.isUsablePrintIF());
      } else {
        console.log('connecting socket');
        // The socket handshake (CONNECT -> PUBKEY -> ADMININFO) completes
        // asynchronously over several message round-trips; registCallback()
        // is invoked by registIFAccessResult() once that exchange settles
        // (success or failure), which is what this await is waiting on.
        await new Promise<void>((resolve) => {
          this.conection.registCallback(() => resolve());
          // If the socket transport can't even start (e.g. the legacy
          // socket.io-client fails to load in this environment), degrade the
          // same way a socket error does: probe the HTTP service and fall
          // back to it. Without this, a rejection here would leave connect()
          // hanging forever — registIFAccessResult would never fire.
          this.connectBySocketIo(CONNECT_TIMEOUT).catch(() => this.handleSocketError());
        });
        console.log('connected socket', this.conection.isUsablePrintIF());
      }

      if (this.conection.isUsablePrintIF()) {
        return RESULT_OK;
      } else {
        return CONNECTION_ERRORS.ERROR_PARAMETER;
      }
    } catch {
      return CONNECTION_ERRORS.ERROR_PARAMETER;
    }
  }

  isConnected(): boolean {
    const devIsConnect = [CONNECT, RECONNECTING].includes(this.conection.status(IF_EPOSDEVICE));
    const wsIsConnect = [CONNECT].includes(this.conection.status(IF_EPOSPRINT));
    return devIsConnect || wsIsConnect;
  }

  disconnect(): void {
    const eposmsg = MessageFactory.getDisconnectMessage(this.connectionId ?? "");
    this.conection.emit(eposmsg);
    this.cleanup();
  }

  /**
   * Opens a device and resolves with it directly — no callback wiring
   * required. On the socket transport the OPENDEVICE response arrives later
   * as its own message (see procOpenDevice), so this wraps the legacy
   * callback-style flow in a Promise rather than duplicating it; pass a
   * `callback` too if you still need the raw (device, code) shape.
   */
  async createDevice(deviceId: string, deviceType: DeviceType, options: DeviceOptions = {}, callback?: DeviceCallback): Promise<IDevice> {
    return new Promise<IDevice>((resolve, reject) => {
      const settle = ((deviceObject: IDevice | null, code?: string) => {
        callback?.(deviceObject, code);
        if (deviceObject) {
          resolve(deviceObject);
        } else {
          reject(new Error(code || DEVICE_ERRORS.ERROR_DEVICE_OPEN));
        }
      }) as DeviceCallback;
      void this.createDeviceCallback(deviceId, deviceType, options, settle);
    });
  }

  private async createDeviceCallback(deviceId: string, deviceType: DeviceType, options: DeviceOptions, callback: DeviceCallback): Promise<void> {
    try {
      if (!this.isConnected()) {
        throw new Error(CONNECTION_ERRORS.ERROR_SYSTEM);
      }
      if (this.deviceIntances.get(deviceId) != null) {
        throw new Error(ERRORS.ERROR_DEVICE_IN_USE);
      }
      if (!this.devSelector.isSelectable(deviceType)) {
        throw new Error(ERRORS.ERROR_DEVICE_NOT_FOUND);
      }

      let isCrypto = false;
      let isBufferEnable = false;

      if (typeof options === "boolean") {
        isCrypto = options;
      } else {
        isCrypto = options.crypto ?? false;
        isBufferEnable = options.buffer ?? false;
      }

      if (deviceType === TYPES.TYPE_DT) {
        isCrypto = true;
        deviceId = "local_dt";
      }

      const deviceObject = await this.devSelector.select(
        deviceId, 
        deviceType, 
        options.driver, 
        isCrypto, 
        this
      );
      
      deviceObject.setConnection(this.conection);
      const element = new DeviceElement(deviceId, isCrypto, deviceObject, callback);
      this.deviceIntances.add(element);

      if (this.conection.isUsableDeviceIF()) {
        console.log('isUsableDeviceIF true', deviceId, deviceType, isCrypto, isBufferEnable);
        const eposmsg = MessageFactory.getOpenDeviceMessage(
          deviceId, 
          deviceType, 
          isCrypto, 
          isBufferEnable
        );
        this.conection.emit(eposmsg);
      } else {
        this.checkEposPrintService(deviceId, deviceType, (result: string) => {
          if (result === RESULT_OK) {
            callback(deviceObject, RESULT_OK);
          } else {
            callback(null, DEVICE_ERRORS.ERROR_DEVICE_NOT_FOUND);
          }
        });
      }
    } catch (e: any) {
      const message = e.message || DEVICE_ERRORS.ERROR_DEVICE_OPEN;
      if (callback != null) {
        callback(null, message);
      }
    }
  }

  deleteDevice(deviceObject: IDevice, callback: DeviceCallback): void {
    try {
      const element = this.deviceIntances.getByObj(deviceObject);
      if (element == null) {
        throw new Error(DEVICE_ERRORS.ERROR_DEVICE_NOT_OPEN);
      }

      if (this.conection.isUsableDeviceIF()) {
        element.callback = callback;
        const eposmsg = MessageFactory.getCloseDeviceMessage(element.deviceId);
        this.conection.emit(eposmsg);
      } else {
        try {
          if ('finalize' in deviceObject) {
            deviceObject.finalize();
          }
        } catch {
          // Ignore finalization errors
        }
        this.deviceIntances.remove(element.deviceId);
        callback(RESULT_OK);
      }
    } catch (e: any) {
      const message = e.message || DEVICE_ERRORS.ERROR_DEVICE_CLOSE;
      if (callback != null) {
          callback(message);
      }
    }
  }

  getAdmin(): string {
    return this.admin;
  }

  getLocation(): string {
    return this.location;
  }

  sendOfscXml(xml: string, timeout: number, crypto: boolean, callback: (result: any) => void): void {
    this.ofsc.send(xml, timeout, crypto, callback);
  }

  getCommBoxManager(): CommBoxManager | null {
    if (this.conection.status(IF_EPOSDEVICE) !== CONNECT) {
      return null;
    }
    return this.commBoxManager;
  }

  private async connectBySocketIo(timeout: number): Promise<void> {
    // Loaded lazily, and declared as an OPTIONAL peer dependency: this legacy
    // CJS bundle is only needed by the socket transport, and it drags in
    // transitive packages with known CVEs. Keeping it optional means the
    // HTTP-only path — the recommended one, and the only one a plain TM-T88V
    // supports — installs with zero dependencies.
    let io: { connect(host: string, options?: Record<string, unknown>): LegacySocket };
    try {
      io = (await import('socket.io-client')).default;
    } catch {
      throw new Error(
        "The ePOS-Device socket transport needs the optional peer dependency 'socket.io-client@0.8.7'. " +
        "Install it, or use the HTTP transport (EposHttpPrinter / { eposprint: true }), which most printers support."
      );
    }
    const url = this.conection.getSocketIoURL();
    this.socket = io.connect(url, {
      reconnect: false,
      "connect timeout": timeout,
      "force new connection": true
    });
    this.conection.setSocket(this.socket);

    this.socket.on("connect", () => {
      try {
        this.gbox.dispose();
      } catch {
        // Ignore disposal errors
      }
    });

    this.socket.on("close", () => {
      this.conection.changeStatus(IF_EPOSDEVICE, DISCONNECT);
    });

    this.socket.on("disconnect", () => {
      try {
        if (this.conection.status(IF_EPOSDEVICE) === RECONNECTING) {
            return;
        }
        const prevConnectionId = this.cookieIo.readId(this.conection.getAddress());
        if (prevConnectionId === "" && this.connectionId === null) {
            this.cleanup();
        } else {
            this.startReconnectAction();
        }
      } catch (e) {
        console.error(e);
        // Ignore disconnect errors
      }
    });

    this.socket.on("error", () => {
      this.handleSocketError();
    });

    this.socket.on("connect_failed", () => {
      this.handleSocketError();
    });

    this.socket.on("message", (data: any) => {
      this.handleSocketMessage(data);
    });
  }

  private handleSocketError(): void {
    try {
      this.conection.probeWebServiceIF().then(() => {
        if (this.conection.isUsablePrintIF()) {
          this.eposprint = true;
          this.conection.registIFAccessResult(IF_EPOSDEVICE, RESULTS.NONE);
        } else {
          this.conection.changeStatus(IF_EPOSDEVICE, DISCONNECT);
          this.conection.registIFAccessResult(IF_EPOSDEVICE, CONNECTION_ERRORS.ERROR_TIMEOUT);
        }
      });
    } catch {
      // Ignore error handling errors
    }
  }

  private handleSocketMessage(data: any): void {
    try {
      const eposmsg = MessageFactory.parseRequestMessage(data);
      if (eposmsg == null) {
        return;
      }
      if (eposmsg.data_id !== 0) {
        this.recievedDataId = eposmsg.data_id;
      }
      console.log('handleSocketMessage', eposmsg);
      switch (eposmsg.request) {
        case REQUEST.CONNECT:
          this.procConnect(eposmsg);
          break;
        case REQUEST.PUBKEY:
          this.procPubkey(eposmsg);
          break;
        case REQUEST.ADMININFO:
          this.procAdminInfo(eposmsg);
          break;
        case REQUEST.RECONNECT:
          this.procReconnect(eposmsg);
          break;
        case REQUEST.DISCONNECT:
          this.procDisconnect();
          break;
        case REQUEST.OPENDEVICE:
          this.procOpenDevice(eposmsg);
          break;
        case REQUEST.CLOSEDEVICE:
          this.procCloseDevice(eposmsg);
          break;
        case REQUEST.DEVICEDATA:
          this.procDeviceData(eposmsg);
          break;
        case REQUEST.SERVICEDATA:
          this.procServiceData(eposmsg);
          break;
        case REQUEST.OPENCOMMBOX:
          this.procOpenCommBox(eposmsg);
          break;
        case REQUEST.CLOSECOMMBOX:
          this.procCloseCommBox(eposmsg);
          break;
        case REQUEST.COMMDATA:
          this.procCommBoxData(eposmsg);
          break;
        case REQUEST.ERROR:
          this.procError(eposmsg);
          break;
        default:
          break;
      }
    } catch {
      // Ignore message processing errors
    }
  }

  private procConnect(eposmsg: ePosDeviceMessage): void {
    try {
      if (this.reconnectTimerId !== 0) {
        clearInterval(this.reconnectTimerId);
        this.reconnectTimerId = 0;
      }

      let response = null;
      const prevConnectionId = this.cookieIo.readId(this.conection.getAddress());

      eposmsg.data = eposmsg.data as MsgData;

      if (eposmsg.data.protocol_version < 2) {
        response = MessageFactory.getPubkeyMessage(
          eposmsg.data.prime, 
          eposmsg.data.key
        );
        this.conection.emit(response);
      } else {
        if (this.connectionId != null) {
          response = MessageFactory.getReconnectMessage(
            this.connectionId,
            eposmsg.data.client_id,
            this.recievedDataId
          );
          this.conection.emit(response);
        } else {
          if (prevConnectionId !== "") {
            response = MessageFactory.getDisconnectMessage(prevConnectionId);
            this.conection.emit(response);
            response = MessageFactory.getPubkeyMessage(
              eposmsg.data.prime,
              eposmsg.data.key
            );
            this.conection.emit(response);
          } else {
            response = MessageFactory.getPubkeyMessage(
              eposmsg.data.prime,
              eposmsg.data.key
            );
            this.conection.emit(response);
          }
        }
      }

      this.cookieIo.writeId(eposmsg.data.client_id, this.conection.getAddress());
      this.connectionId = eposmsg.data.client_id;
    } catch {
      this.conection.registIFAccessResult(
        IF_EPOSDEVICE,
        CONNECTION_ERRORS.ERROR_SYSTEM
      );
      this.cleanup();
    }
  }

  private procPubkey(eposmsg: ePosDeviceMessage): void {
    try {
      if (eposmsg.code === CODES.SHARED_KEY_MISMATCH_ERROR) {
        console.log("agarrate, agarrate, agarrate..... SHARED_KEY_MISMATCH_ERROR");
        const mismatchErrTime = new Date().getTime();
        let mismatchTimeout = 0;

        if (this.connectStartTime !== 0) {
            mismatchTimeout = mismatchErrTime - this.connectStartTime;
            if (mismatchTimeout < CONNECT_TIMEOUT) {
              this.gbox.stock(this.socket!);
              this.connectionId = null;
              this.waitRetryConnectId = setTimeout(() => {
                void this.connectBySocketIo(CONNECT_TIMEOUT - mismatchTimeout);
              }, 100);
            } else {
              this.conection.registIFAccessResult(
                  IF_EPOSDEVICE,
                  CONNECTION_ERRORS.ERROR_TIMEOUT
              );
              this.cleanup();
            }
          } else {
            this.conection.registIFAccessResult(
                IF_EPOSDEVICE,
                CONNECTION_ERRORS.ERROR_TIMEOUT
            );
            this.cleanup();
          }
        } else if (eposmsg.code === CODES.PARAM_ERROR) {
          this.conection.registIFAccessResult(
              IF_EPOSDEVICE,
              CONNECTION_ERRORS.ERROR_PARAMETER
          );
          this.cleanup();
        } else {
          const response = MessageFactory.getAdminInfoMessage();
          this.conection.emit(response);
        }
    } catch {
      this.conection.registIFAccessResult(
          IF_EPOSDEVICE,
          CONNECTION_ERRORS.ERROR_SYSTEM
      );
      this.cleanup();
    }
  }

  private procReconnect(eposmsg: ePosDeviceMessage): void {
    if (this.conection.status(IF_EPOSDEVICE) != RECONNECTING) {
      return
    }
    if (eposmsg.code == CODES.RESULT_OK) {
      this.conection.changeStatus(IF_EPOSDEVICE, CONNECT);
      if (this.onreconnect != null) {
        this.onreconnect()
      }
    } else {
      this.cleanup()
    }
  };

  // Intentional no-op, matching the vendor SDK exactly (see eposdevice.js's
  // own `procDisconnect: function(eposmsg) {}`). The <disconnect> message is
  // purely a request/ack pair for the client's own disconnect() call, which
  // already runs cleanup() synchronously before any ack can arrive — so by
  // the time this fires, there's nothing left to react to. Per the official
  // ePOS-Device XML manual, real disconnection notifications are meant to
  // go through <reconnect> exhaustion (cleanup() firing ondisconnect), not
  // through this message.
  private procDisconnect(): void {}

  private procAdminInfo(eposmsg: ePosDeviceMessage): void {
    if (this.eposprint) {
      return;
    }

    if (eposmsg.code !== CODES.RESULT_OK) {
      this.conection.registIFAccessResult(
        IF_EPOSDEVICE,
        CONNECTION_ERRORS.ERROR_SYSTEM
      );
      return;
    }

    eposmsg.data = eposmsg.data as MsgData;
    this.admin = eposmsg.data.admin_name;
    this.location = eposmsg.data.location;
    this.conection.registIFAccessResult(
      IF_EPOSDEVICE,
      RESULTS.OK
    );
  }

  private startReconnectAction(): void {
    if (this.conection.status(IF_EPOSDEVICE) === RECONNECTING) {
      return;
    }

    this.conection.changeStatus(IF_EPOSDEVICE, RECONNECTING);
    this.reconnectTryCount = 0;

    this.reconnectTimerId = setInterval(() => {
      if (this.socket != null) {
        this.gbox.stock(this.socket);
      }

      if (this.reconnectTryCount == MAX_RECONNECT_RETRY) {
        clearInterval(this.reconnectTimerId!);
        this.cleanup();
        return;
      }

      if (this.conection.status(IF_EPOSDEVICE) === RECONNECTING) {
        void this.connectBySocketIo(RECONNECT_TIMEOUT);
      }

      this.reconnectTryCount++;
    }, RECONNECT_TIMEOUT);

    if (this.reconnectTryCount === 0 && this.onreconnecting != null) {
      this.onreconnecting();
    }
  }

  public cleanup(): void {
    if (this.waitRetryConnectId !== 0) {
      clearTimeout(this.waitRetryConnectId);
      this.waitRetryConnectId = 0;
    }

    this.connectStartTime = 0;
    this.gbox.stock(this.socket!);
    this.gbox.dispose();

    const deviceElements = this.deviceIntances.getElementList();
    deviceElements.forEach(deviceElement => {
      try {
        if ('finalize' in deviceElement.deviceObject) {
          deviceElement.deviceObject.finalize();
        }
      } catch (e) {
        console.error(e);
      }
    });

    this.deviceIntances.removeAll();

    if (
      this.ondisconnect && 
      (this.conection.status(IF_EPOSDEVICE) !== DISCONNECT || 
        this.conection.status(IF_EPOSPRINT) !== DISCONNECT)
    ) {
      this.ondisconnect();
    }

    this.cookieIo.writeId("", this.conection.getAddress());
    this.conection.changeStatus(IF_ALL, DISCONNECT);
    this.socket = null;
    this.connectionId = null;
    this.conection.closeSocket();

    if (this.reconnectTimerId !== 0) {
      clearInterval(this.reconnectTimerId);
      this.reconnectTimerId = 0;
    }

    this.reconnectTryCount = 0;
    this.admin = "";
    this.location = "";
    this.recievedDataId = 0;
    this.eposprint = false;
  }

  private procOpenDevice(eposmsg: ePosDeviceMessage): void {
    const deviceId = eposmsg.deviceId;
    try {
      const element = this.deviceIntances.get(deviceId);
      if (eposmsg.code === CODES.RESULT_OK) {
        if (element?.callback != null) {
          element.callback(element.deviceObject, eposmsg.code);
        }
      } else {
        if (element?.callback != null) {
          element.callback(null, eposmsg.code);
        }
        this.deviceIntances.remove(deviceId);
      }
    } catch {
      if (this.onerror != null) {
        this.onerror("0", deviceId, CONNECTION_ERRORS.ERROR_SYSTEM, null);
      }
    }
  }

  private procCloseDevice(eposmsg: ePosDeviceMessage): void {
    const deviceId = eposmsg.deviceId;
    try {
      if (eposmsg.code === CODES.RESULT_OK) {
        const element = this.deviceIntances.get(deviceId);
        if (element?.callback != null) {
          element.callback(eposmsg.code);
        }
        try {
          if (element?.deviceObject && 'finalize' in element.deviceObject) {
            element.deviceObject.finalize();
          }
        } catch {
          // Ignorar errores de finalización
        }
        this.deviceIntances.remove(deviceId);
      }
    } catch {
      if (this.onerror != null) {
        this.onerror("0", deviceId, CONNECTION_ERRORS.ERROR_SYSTEM, null);
      }
    }
  }

  private procDeviceData(eposmsg: ePosDeviceMessage): void {
    const deviceId = eposmsg.deviceId;
    const sequence = eposmsg.sequence;
    const data = eposmsg.data;

    try {
      const deviceInstance = this.deviceIntances.get(deviceId);
      if (!deviceInstance) return;

      let processedData = data as MsgData;
      if (deviceInstance.isCrypto) {
        processedData = MessageFactory.decrypt(data as string);
      }

      const deviceObject = deviceInstance.deviceObject;
      const method = `client_${processedData.type}`;

      try {
        if ('client_onreceive' in deviceObject) {
          (deviceObject as any).client_onreceive(processedData, sequence);
        } else if (method in deviceObject) {
          (deviceObject as any)[method](processedData, sequence);
        } else if (processedData.type in deviceObject) {
          (deviceObject as any)[processedData.type](processedData, sequence);
        }
      } catch {
        if (this.onerror != null) {
          this.onerror(sequence.toString(), deviceId, CONNECTION_ERRORS.ERROR_SYSTEM, null);
        }
      }
    } catch {
      if (this.onerror != null) {
        this.onerror(sequence.toString(), deviceId, CONNECTION_ERRORS.ERROR_SYSTEM, null);
      }
    }
  }

  private procServiceData(eposmsg: ePosDeviceMessage): void {
    try {
      if (eposmsg.serviceId === "OFSC") {
        (this.ofsc as any).notify(eposmsg);
      }
    } catch {
      if (this.onerror != null) {
        this.onerror(eposmsg.sequence.toString(), eposmsg.serviceId, CONNECTION_ERRORS.ERROR_SYSTEM, null);
      }
    }
  }

  private procOpenCommBox(eposmsg: ePosDeviceMessage): void {
    try {
      this.commBoxManager.client_opencommbox(eposmsg.data, eposmsg.sequence);
    } catch {
      if (this.onerror != null) {
        this.onerror(eposmsg.sequence.toString(), "", CONNECTION_ERRORS.ERROR_SYSTEM, null);
      }
    }
  }

  private procCloseCommBox(eposmsg: ePosDeviceMessage): void {
    try {
      this.commBoxManager.client_closecommbox(eposmsg.data, eposmsg.sequence);
    } catch {
      if (this.onerror != null) {
        this.onerror(eposmsg.sequence.toString(), "", CONNECTION_ERRORS.ERROR_SYSTEM, null);
      }
    }
  }

  private procCommBoxData(eposmsg: ePosDeviceMessage): void {
    try {
      this.commBoxManager.executeCommDataCallback(eposmsg.data, eposmsg.sequence);
    } catch {
      if (this.onerror != null) {
        this.onerror(eposmsg.sequence.toString(), "", CONNECTION_ERRORS.ERROR_SYSTEM, null);
      }
    }
  }

  private procError(eposmsg: ePosDeviceMessage): void {
    try {
      if (this.onerror != null) {
        this.onerror(eposmsg.sequence.toString(), eposmsg.deviceId, eposmsg.code, eposmsg.data);
      }
    } catch {
      // Ignorar errores en el manejo de errores
    }
  }

  private async checkEposPrintService(deviceId: string, deviceType: DeviceType, callback: (result: string) => void): Promise<void> {
    this.cbCheckEposPrintService = callback;

    let postUrl = `${this.conection.getOrigin()}/cgi-bin/epos/service.cgi?devid=${deviceId}&timeout=10000`;
    let postData = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"></epos-print></s:Body></s:Envelope>';

    if (deviceType === TYPES.TYPE_DISPLAY) {
      postUrl = `${this.conection.getOrigin()}/cgi-bin/eposDisp/service.cgi?devid=${deviceId}&timeout=10000`;
      postData = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-display xmlns="http://www.epson-pos.com/schemas/2012/09/epos-display"></epos-display></s:Body></s:Envelope>';
    }

    try {
      const response = await postPrintRequest(postUrl, postData, 5000);
      this.cbCheckEposPrintService?.(response.success ? RESULT_OK : DEVICE_ERRORS.ERROR_DEVICE_NOT_FOUND);
    } catch {
      this.cbCheckEposPrintService?.(CONNECTION_ERRORS.ERROR_PARAMETER);
    } finally {
      this.cbCheckEposPrintService = null;
    }
  }
}