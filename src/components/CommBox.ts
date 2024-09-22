import { MessageFactory } from './MessageFactory';
import { CallbackInfo } from './CallbackInfo';
import { CommBoxManager } from './CommBoxManager';

export class CommBox {
  private ERROR_OK: string = 'OK';
  private ERROR_NOT_OPENED: string = 'NOT_OPENED';
  private ERROR_MEMBER_NOT_FOUND: string = 'MEMBER_NOT_FOUND';
  private ERROR_SYSTEM_ERROR: string = 'SYSTEM_ERROR';
  private boxID: string;
  private commBoxManager: CommBoxManager;
  private callbackInfo: CallbackInfo;
  private connectionObj: any;
  public onreceive: ((data: any) => void) | null = null;

  constructor(boxID: string, commBoxManager: CommBoxManager, callbackInfo: CallbackInfo) {
    this.boxID = boxID;
    this.commBoxManager = commBoxManager;
    this.callbackInfo = callbackInfo;
    this.connectionObj = commBoxManager.getConnectionObject();
  }

  public getCommHistory(option?: { allHistory?: boolean }): Promise<any> {
    return new Promise((resolve, reject) => {
      const allHistory = option?.allHistory ?? false;
      const data = {
        type: 'getcommhistory',
        box_id: this.boxID,
        all_history: allHistory,
      };
      const eposmsg = MessageFactory.getCommBoxDataMessage(data);

      if (!this.commBoxManager.isOpened(this.getBoxId())) {
        return reject({ error: this.ERROR_NOT_OPENED, sequence: eposmsg.sequence });
      }

      this.callbackInfo.addCallback(resolve, eposmsg.sequence);
      this.connectionObj.emit(eposmsg);
    });
  }

  public send(message: string, memberID: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = {
        type: 'send',
        box_id: this.boxID,
        message,
        member_id: memberID,
      };
      const eposmsg = MessageFactory.getCommBoxDataMessage(data);

      if (!this.commBoxManager.isOpened(this.getBoxId())) {
        return reject({ error: this.ERROR_NOT_OPENED, sequence: eposmsg.sequence });
      }

      this.callbackInfo.addCallback(resolve, eposmsg.sequence);
      this.connectionObj.emit(eposmsg);
    });
  }

  public client_getcommhistory(data: any, sq: string): void {
    const code = data.code;
    const historyList = data.history_list;
    const getCommHistoryCB = this.callbackInfo.getCallback(sq);
    this.callbackInfo.removeCallback(sq);
    if (getCommHistoryCB) {
      getCommHistoryCB(code, historyList, sq);
    }
  }

  public client_send(data: any, sq: string): void {
    const code = data.code;
    const count = data.count;
    const sendCB = this.callbackInfo.getCallback(sq);
    this.callbackInfo.removeCallback(sq);
    if (sendCB) {
      sendCB(code, count, sq);
    }
  }

  public client_onreceive(data: any): void {
    const rcvData = {
      senderId: data.sender_id,
      receiverId: data.receiver_id,
      message: data.message,
    };

    if (this.onreceive) {
      this.onreceive(rcvData);
    }
  }

  public getBoxId(): string {
    return this.boxID;
  }
}
