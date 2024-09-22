import { MessageFactory } from './MessageFactory'; // Asumiendo que el MessageFactory está en otro archivo
import { toHexBinary } from '../commons/utils';

export class CashChanger {
  public readonly CONFIG_LEFT_CASH: string = 'CONFIG_LEFT_CASH';
  public readonly CONFIG_COUNT_MODE: string = 'CONFIG_COUNT_MODE';
  public readonly MODE_MANUAL_INPUT: string = 'MODE_MANUAL_INPUT';
  public readonly MODE_AUTOCOUNT: string = 'MODE_AUTO_COUNT';
  public readonly DEPOSIT_CHANGE: string = 'DEPOSIT_CHANGE';
  public readonly DEPOSIT_NOCHANGE: string = 'DEPOSIT_NOCHANGE';
  public readonly DEPOSIT_REPAY: string = 'DEPOSIT_REPAY';
  public readonly COLLECT_ALL_CASH: string = 'ALL_CASH';
  public readonly COLLECT_PART_OF_CASH: string = 'PART_OF_CASH';
  public readonly SUE_POWER_ONLINE: number = 2001;
  public readonly SUE_POWER_OFF: number = 2002;
  public readonly SUE_POWER_OFFLINE: number = 2003;
  public readonly SUE_POWER_OFF_OFFLINE: number = 2004;
  public readonly SUE_STATUS_EMPTY: number = 11;
  public readonly SUE_STATUS_NEAREMPTY: number = 12;
  public readonly SUE_STATUS_EMPTYOK: number = 13;
  public readonly SUE_STATUS_FULL: number = 21;
  public readonly SUE_STATUS_NEARFULL: number = 22;
  public readonly SUE_STATUS_FULLOK: number = 23;
  public readonly SUE_STATUS_JAM: number = 31;
  public readonly SUE_STATUS_JAMOK: number = 32;

  public deviceID: string;
  public isCrypto: boolean;
  private connectionObj: any;

  constructor(deviceID: string, isCrypto: boolean) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connectionObj = null;
  }

  public setConnectionObject(connectionObj: any): void {
    this.connectionObj = connectionObj;
  }

  private handleEvent(callback: ((data: any) => void) | null, data: any): void {
    if (callback) {
      try {
        callback(data);
      } catch (e) {
        console.error('Error handling event:', e);
      }
    }
  }

  public client_oncashcounts(data: any): void {
    this.handleEvent(this.oncashcounts, data);
  }

  public client_onstatuschange(data: any): void {
    this.handleEvent(this.onstatuschange, data);
  }

  public client_ondeposit(data: any): void {
    this.handleEvent(this.ondeposit, data);
  }

  public client_ondispense(data: any): void {
    this.handleEvent(this.ondispense, data);
  }

  public client_oncollect(data: any): void {
    this.handleEvent(this.oncollect, data);
  }

  public client_onconfigchange(data: any): void {
    this.handleEvent(this.onconfigchange, data);
  }

  public client_oncommandreply(data: any): void {
    if (data.command) {
      try {
        let hexData = data.data.replace(/[0-9a-fA-F]{2}/g, (c: string) => String.fromCharCode(parseInt(c, 16)));
        data.data = hexData;
      } catch (e) {
        console.error('Error parsing command reply:', e);
      }
    }
    this.handleEvent(this.oncommandreply, data);
  }

  public client_ondirectio(data: any): void {
    this.handleEvent(this.ondirectio, data);
  }

  public client_onstatusupdate(data: any): void {
    this.handleEvent(this.onstatusupdate, data);
  }

  // Define the possible event handlers as optional properties
  public oncashcounts: ((data: any) => void) | null = null;
  public onstatuschange: ((data: any) => void) | null = null;
  public ondeposit: ((data: any) => void) | null = null;
  public ondispense: ((data: any) => void) | null = null;
  public oncollect: ((data: any) => void) | null = null;
  public onconfigchange: ((data: any) => void) | null = null;
  public oncommandreply: ((data: any) => void) | null = null;
  public ondirectio: ((data: any) => void) | null = null;
  public onstatusupdate: ((data: any) => void) | null = null;

  // Methods for device operations
  public readCashCounts(): number {
    return this.send({ type: 'readcashcounts' });
  }

  public beginDeposit(): number {
    return this.send({ type: 'begindeposit' });
  }

  public pauseDeposit(): number {
    return this.send({ type: 'pausedeposit' });
  }

  public restartDeposit(): number {
    return this.send({ type: 'restartdeposit' });
  }

  public endDeposit(cmd: string): number {
    return this.send({ type: 'enddeposit', cmd });
  }

  public dispenseCash(data: any): number {
    const payload = typeof data === 'object' ? { ...data, type: 'dispensecash' } : { type: 'dispensecash', cash: data };
    return this.send(payload);
  }

  public dispenseChange(cash: any): number {
    const payload = typeof cash === 'object' ? { ...cash, type: 'dispensechange' } : { type: 'dispensechange', cash };
    return this.send(payload);
  }

  public openDrawer(): number {
    return this.send({ type: 'opendrawer' });
  }

  public collectCash(collectMode: string): number {
    return this.send({ type: 'collectcash', collectmode: collectMode });
  }

  public setConfig(config: string, value: any): number {
    let data: any = null;

    switch (config) {
      case this.CONFIG_COUNT_MODE:
        data = { type: 'setconfig', config, mode: value.mode };
        break;
      case this.CONFIG_LEFT_CASH:
        data = {
          type: 'setconfig',
          config,
          bills: value.bills ?? '0',
          coins: value.coins ?? '0',
        };
        break;
      default:
        break;
    }

    return data ? this.send(data) : -1;
  }

  public sendCommand(command: any): number {
    const payload = typeof command === 'object' ? { ...command, type: 'sendcommand' } : { type: 'sendcommand', command: toHexBinary(command) };
    return this.send(payload);
  }

  public callEvent(eventName: string, data: any): number {
    return this.send({ ...data, type: eventName });
  }

  // Method to send data through the connection
  private send(data: any): number {
    const eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
    let sequence = -1;

    try {
      this.connectionObj.emit(eposmsg);
      sequence = eposmsg.sequence;
    } catch (e) {
      console.error('Error sending message:', e);
    }

    return sequence;
  }
}
