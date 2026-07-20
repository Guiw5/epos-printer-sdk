import { CommBoxManager } from "./CommBoxManager";
import { CallbackInfo } from "./CallbackInfo";
import { MessageFactory } from "./MessageFactory";
import { Connection } from "./Connection";
import { MsgData } from "./ePosDeviceMessage";

export class CommBox {
  readonly ERROR_OK = "OK";
  readonly ERROR_NOT_OPENED = "NOT_OPENED";
  readonly ERROR_MEMBER_NOT_FOUND = "MEMBER_NOT_FOUND";
  readonly ERROR_SYSTEM_ERROR = "SYSTEM_ERROR";
  private boxID: string;
  private commBoxManager: CommBoxManager;
  private callbackInfo: CallbackInfo;
  private connection: Connection | null;
  public onreceive: ((data: { senderId: string; receiverId: string; message: string }) => void) | null = null;

  constructor(boxID: string, commBoxManager: CommBoxManager, callbackInfo: CallbackInfo) {
    this.boxID = boxID;
    this.commBoxManager = commBoxManager;
    this.callbackInfo = callbackInfo;
    this.connection = this.commBoxManager.getConnection();
  }

  async getCommHistory(option?: { allHistory?: boolean }): Promise<any> {
    const allHistory = option?.allHistory ?? false;
    const data = { type: "getcommhistory", box_id: this.boxID, all_history: allHistory } as unknown as MsgData;
    const eposmsg = MessageFactory.getCommBoxDataMessage(data);

    return new Promise((resolve, reject) => {
      if (!this.commBoxManager.isOpened(this.boxID)) {
        reject(new Error(this.ERROR_NOT_OPENED));
        return;
      }

      this.callbackInfo.addCallback((code: string, historyList: any) => {
        if (code === this.ERROR_OK) {
          resolve(historyList);
        } else {
          reject(new Error(code));
        }
      }, eposmsg.sequence);

      this.connection!.emit(eposmsg);
    });
  }

  async send(message: string, memberID: string): Promise<number> {
    const data = { type: "send", box_id: this.boxID, message, member_id: memberID } as unknown as MsgData;
    const eposmsg = MessageFactory.getCommBoxDataMessage(data);

    return new Promise((resolve, reject) => {
      if (!this.commBoxManager.isOpened(this.boxID)) {
        reject(new Error(this.ERROR_NOT_OPENED));
        return;
      }

      this.callbackInfo.addCallback((code: string, count: number) => {
        if (code === this.ERROR_OK) {
          resolve(count);
        } else {
          reject(new Error(code));
        }
      }, eposmsg.sequence);

      this.connection!.emit(eposmsg);
    });
  }

  client_getcommhistory(data: { code: string; history_list: any }, sq: number): void {
    const getCommHistoryCB = this.callbackInfo.getCallback(sq);
    this.callbackInfo.removeCallback(sq);
    getCommHistoryCB?.(data.code, data.history_list, sq);
  }

  client_send(data: { code: string; count: number }, sq: number): void {
    const sendCB = this.callbackInfo.getCallback(sq);
    this.callbackInfo.removeCallback(sq);
    sendCB?.(data.code, data.count, sq);
  }

  client_onreceive(data: { sender_id: string; receiver_id: string; message: string }): void {
    const { sender_id: senderId, receiver_id: receiverId, message } = data;
    this.onreceive?.({ senderId, receiverId, message });
  }

  getBoxId(): string {
    return this.boxID;
  }
}
