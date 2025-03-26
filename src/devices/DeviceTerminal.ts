import { Connection } from "../components/Connection";
import { MessageFactory } from "../components/MessageFactory";

export class DeviceTerminal {
  private deviceID: string;
  private isCrypto: boolean;
  private connection: Connection | null = null;

  private onshutdown: ((data: any) => void) | null = null;
  private onrestart: ((data: any) => void) | null = null;

  constructor(deviceID: string, isCrypto: boolean, connection?: Connection) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connection = connection ?? null;
  }

  setConnection(connection: Connection): void {
    this.connection = connection;
  }

  shutdown(password: string, callback: (data: any) => void): number {
    this.onshutdown = callback;
    const data = { type: "shutdown", password };
    return this.send(data);
  }

  client_onshutdown(data: any): void {
    try {
      if (typeof this.onshutdown !== "function") {
        return;
      }
      this.onshutdown(data);
    } catch (e) {}
  }

  restart(password: string, callback: (data: any) => void): number {
    this.onrestart = callback;
    const data = { type: "restart", password };
    return this.send(data);
  }

  client_onrestart(data: any): void {
    try {
      if (typeof this.onrestart !== "function") {
        return;
      }
      this.onrestart(data);
    } catch (e) {}
  }

  private send(data: Record<string, any>): number {
    const eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
    let sequence = -1;
    try {
      this.connection?.emit(eposmsg);
      sequence = eposmsg.sequence;
    } catch (e) {}
    return sequence;
  }
}
