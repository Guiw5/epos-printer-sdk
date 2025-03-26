import { CommBoxManager } from "./CommBoxManager";
import { CallbackInfo } from "./CallbackInfo";
import { MessageFactory } from "./MessageFactory";
import { Connection } from "./Connection";

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

  getCommHistory(option?: { allHistory?: boolean }, callback?: (error: string | null, historyList?: any, seq?: number) => void): number {
    const allHistory = option?.allHistory ?? false;
    const data = { type: "getcommhistory", box_id: this.boxID, all_history: allHistory };
    return this.emit(data, callback);
  }

  send(message: string, memberID: string, callback?: (error: string | null, count?: number, seq?: number) => void): number {
    const data = { type: "send", box_id: this.boxID, message, member_id: memberID };
    return this.emit(data, callback);
  }

  emit(data: any, callback?: (error: string | null, historyList?: any, seq?: number) => void): number {
    const eposmsg = MessageFactory.getCommBoxDataMessage(data);

    if (!this.commBoxManager.isOpened(this.boxID)) {
      callback?.(this.ERROR_NOT_OPENED, null, eposmsg.sequence);
      return eposmsg.sequence;
    }

    if (callback) this.callbackInfo.addCallback(callback, eposmsg.sequence);    

    this.connection!.emit(eposmsg);
    return eposmsg.sequence;
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
