import { CallbackInfo } from "./CallbackInfo";
import { CommBox } from "./CommBox";
import { Connection } from "./Connection";
import { Data, MsgData } from "./ePosDeviceMessage";
import { MessageFactory } from "./MessageFactory";

export class CommBoxManager {
  readonly RES_OK = "OK";
  readonly ERROR_BOX_COUNT_OVER = "BOX_COUNT_OVER";
  readonly ERROR_BOX_CLIENT_OVER = "BOX_CLIENT_OVER";
  readonly ERROR_MEMBERID_ALREADY_USED = "MEMBERID_ALREADY_USED";
  readonly ERROR_ALREADY_OPENED = "ALREADY_OPENED";
  readonly ERROR_NOT_OPENED = "NOT_OPENED";
  readonly ERROR_PARAMETER_ERROR = "PARAMETER_ERROR";
  readonly ERROR_SYSTEM_ERROR = "SYSTEM_ERROR";
  private callbackInfo: CallbackInfo;
  private commBoxList: CommBox[];
  private connection: Connection | null;

  constructor(connection?: Connection) {
    this.callbackInfo = new CallbackInfo();
    this.commBoxList = [];
    this.connection = connection ?? null;
  }

  setConnection(connection: Connection): void {
    this.connection = connection;
  }

  getConnection(): Connection | null {
    return this.connection;
  }

  async openCommBox(boxID: string, option?: { memberID?: string }): Promise<CommBox> {
    const memberID = option?.memberID ?? "";
    const data = { box_id: boxID, member_id: memberID } as MsgData;
    const eposmsg = MessageFactory.getOpenCommBoxMessage(data);

    return new Promise<CommBox>((resolve, reject) => {
      if (!this.connection?.isUsableDeviceIF()) {
        reject(new Error(this.ERROR_SYSTEM_ERROR));
        return;
      }

      this.callbackInfo.addCallback((commBox: CommBox | null, error: string) => {
        if (commBox) {
          resolve(commBox);
        } else if (error === this.RES_OK) {
          // Server said OK but the box was already in our local list, so
          // client_opencommbox handed back null (vendor behavior: it never
          // returns the existing instance). Surface the vendor's own
          // constant for this instead of a nonsensical Error("OK").
          reject(new Error(this.ERROR_ALREADY_OPENED));
        } else {
          reject(new Error(error));
        }
      }, eposmsg.sequence);

      this.connection.emit(eposmsg);
    });
  }

  async closeCommBox(boxObj: CommBox): Promise<void> {
    const boxID = boxObj.getBoxId();
    const data = { box_id: boxID } as MsgData;
    const eposmsg = MessageFactory.getCloseCommBoxMessage(data);

    return new Promise<void>((resolve, reject) => {
      if (!this.isOpened(boxID)) {
        reject(new Error(this.ERROR_NOT_OPENED));
        return;
      }

      try {
        this.connection?.emit(eposmsg);
      } catch {
        reject(new Error(this.ERROR_PARAMETER_ERROR));
        return;
      }

      this.callbackInfo.addCallback((code: string) => {
        if (code === this.RES_OK) {
          resolve();
        } else {
          reject(new Error(code));
        }
      }, eposmsg.sequence);
    });
  }
  client_opencommbox(data: Data, sq: number): void {
    const { box_id, code } = data as MsgData;
    let commBox: CommBox | null = null;

    if (code === this.RES_OK && !this.getCommBox(box_id)) {
      commBox = new CommBox(box_id, this, this.callbackInfo);
      this.commBoxList.push(commBox);
    }

    const openCommBoxCB = this.callbackInfo.getCallback(sq);
    this.callbackInfo.removeCallback(sq);
    openCommBoxCB?.(commBox, code, sq);
  }

  client_closecommbox(data: Data, sq: number): void {
    const { box_id, code } = data as MsgData;

    this.removeCommBox(box_id);

    const closeCommBoxCB = this.callbackInfo.getCallback(sq);
    this.callbackInfo.removeCallback(sq);
    closeCommBoxCB?.(code, sq);
  }

  executeCommDataCallback(data: Data, sq: number): void {
    const { box_id, type } = data as MsgData;

    const commBox = this.getCommBox(box_id);
    if (!commBox) {
      throw new Error(`CommBox ${box_id} not found.`);
    }

    const method = `client_${type}` as keyof CommBox;
    if (typeof commBox[method] !== "function") {
      throw new Error(`Method ${method} not found on CommBox.`);
    }

    try {
      // .call(commBox, ...), invoking the detached function would lose
      // `this`, breaking this.callbackInfo inside client_send & co. (the
      // vendor's eval("commBoxObj.client_x(...)") kept the receiver).
      (commBox[method] as (data: any, sq: number) => void).call(commBox, data, sq);
    } catch {
      throw new Error(`Failed to run ${method} on commbox ${box_id}.`);
    }
  }

  getCommBox(boxID: string): CommBox | null {
    return this.commBoxList.find((box) => box.getBoxId() === boxID) ?? null;
  }

  removeCommBox(boxID: string): boolean {
    const index = this.commBoxList.findIndex((box) => box.getBoxId() === boxID);
    if (index !== -1) {
      this.commBoxList.splice(index, 1);
      return true;
    }
    return false;
  }

  isOpened(boxID: string): boolean {
    return this.commBoxList.some((box) => box.getBoxId() === boxID);
  }
}
