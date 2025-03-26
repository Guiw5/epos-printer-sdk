import { toHexBinary } from "../builders/utils";
import { Connection } from "../components/Connection";
import { MessageFactory } from "../components/MessageFactory";

export class CashChanger {
  readonly CONFIG_LEFT_CASH = "CONFIG_LEFT_CASH";
  readonly CONFIG_COUNT_MODE = "CONFIG_COUNT_MODE";
  readonly MODE_MANUAL_INPUT = "MODE_MANUAL_INPUT";
  readonly MODE_AUTOCOUNT = "MODE_AUTO_COUNT";
  readonly DEPOSIT_CHANGE = "DEPOSIT_CHANGE";
  readonly DEPOSIT_NOCHANGE = "DEPOSIT_NOCHANGE";
  readonly DEPOSIT_REPAY = "DEPOSIT_REPAY";
  readonly COLLECT_ALL_CASH = "ALL_CASH";
  readonly COLLECT_PART_OF_CASH = "PART_OF_CASH";
  readonly SUE_POWER_ONLINE = 2001;
  readonly SUE_POWER_OFF = 2002;
  readonly SUE_POWER_OFFLINE = 2003;
  readonly SUE_POWER_OFF_OFFLINE = 2004;
  readonly SUE_STATUS_EMPTY = 11;
  readonly SUE_STATUS_NEAREMPTY = 12;
  readonly SUE_STATUS_EMPTYOK = 13;
  readonly SUE_STATUS_FULL = 21;
  readonly SUE_STATUS_NEARFULL = 22;
  readonly SUE_STATUS_FULLOK = 23;
  readonly SUE_STATUS_JAM = 31;
  readonly SUE_STATUS_JAMOK = 32;

  private deviceID: string;
  private isCrypto: boolean;
  private connection: Connection | null = null;

  constructor(deviceID: string, isCrypto: boolean, connection?: Connection) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connection = connection ?? null;
  }

  setConnection(connection: Connection): void {
    this.connection = connection;
  }

  private send(data: any): number {
    const eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
    let sequence = -1;

    try {
      this.connection?.emit(eposmsg);
      sequence = eposmsg.sequence;
    } catch (e) {
      console.error("Error al enviar el mensaje:", e);
    }

    return sequence;
  }

  readCashCounts(): number {
    return this.send({ type: "readcashcounts" });
  }

  beginDeposit(): number {
    return this.send({ type: "begindeposit" });
  }

  pauseDeposit(): number {
    return this.send({ type: "pausedeposit" });
  }

  restartDeposit(): number {
    return this.send({ type: "restartdeposit" });
  }

  endDeposit(cmd: string): number {
    return this.send({ type: "enddeposit", cmd });
  }

  dispenseCash(data: string | Record<string, any>): number {
    const formattedData = typeof data === "object"
      ? { ...data, type: "dispensecash" }
      : { type: "dispensecash", cash: data };

    return this.send(formattedData);
  }

  dispenseChange(cash: string | Record<string, any>): number {
    const formattedData = typeof cash === "object"
      ? { ...cash, type: "dispensechange" }
      : { type: "dispensechange", cash };

    return this.send(formattedData);
  }

  openDrawer(): number {
    return this.send({ type: "opendrawer" });
  }

  collectCash(collectMode: string): number {
    return this.send({ type: "collectcash", collectmode: collectMode });
  }

  setConfig(config: string, value: any): number {
    let data: Record<string, any> | null = null;

    switch (config) {
      case this.CONFIG_COUNT_MODE:
        data = { type: "setconfig", config, mode: value.mode };
        break;
      case this.CONFIG_LEFT_CASH:
        data = {
          type: "setconfig",
          config,
          bills: value.bills ?? "0",
          coins: value.coins ?? "0"
        };
        break;
    }

    return data ? this.send(data) : -1;
  }

  sendCommand(command: string | Record<string, any>): number {
    const formattedData = typeof command === "object"
      ? { ...command, type: "sendcommand" }
      : { type: "sendcommand", command: toHexBinary(command) };

    return this.send(formattedData);
  }

  callEvent(eventName: string, data: any): number {
    return this.send({ ...data, type: eventName });
  }

  // **Event Handlers**
  client_oncashcounts(data: any): void {
    this.oncashcounts?.(data);
  }

  client_onstatuschange(data: any): void {
    this.onstatuschange?.(data);
  }

  client_ondeposit(data: any): void {
    this.ondeposit?.(data);
  }

  client_ondispense(data: any): void {
    this.ondispense?.(data);
  }

  client_oncollect(data: any): void {
    this.oncollect?.(data);
  }

  client_onconfigchange(data: any): void {
    this.onconfigchange?.(data);
  }

  client_oncommandreply(data: { command?: string; data: string }): void {
    if (!data.command) {
      data.data = data.data.replace(/[0-9a-fA-F]{2}/g, (c) =>
        String.fromCharCode(parseInt(c, 16))
      );
    }
    this.oncommandreply?.(data);
  }

  client_ondirectio(data: any): void {
    this.ondirectio?.(data);
  }

  client_onstatusupdate(data: any): void {
    this.onstatusupdate?.(data);
  }

  // **Callback Properties**
  oncashcounts?: (data: any) => void;
  onstatuschange?: (data: any) => void;
  ondeposit?: (data: any) => void;
  ondispense?: (data: any) => void;
  oncollect?: (data: any) => void;
  onconfigchange?: (data: any) => void;
  oncommandreply?: (data: any) => void;
  ondirectio?: (data: any) => void;
  onstatusupdate?: (data: any) => void;
}
