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

  openCommBox(boxID: string, option?: { memberID?: string }, callback?: (commBox: CommBox | null, error: string, seq: number) => void): number {
    const memberID = option?.memberID ?? "";
    const data = { box_id: boxID, member_id: memberID } as MsgData;
    const eposmsg = MessageFactory.getOpenCommBoxMessage(data);

    if (!this.connection?.isUsableDeviceIF) {
      callback?.(null, this.ERROR_SYSTEM_ERROR, eposmsg.sequence);
      return eposmsg.sequence;
    }

    this.connection.emit(eposmsg);
    if (callback) this.callbackInfo.addCallback(callback, eposmsg.sequence);

    return eposmsg.sequence;
  }

  closeCommBox(boxObj: CommBox, callback?: (error: string, seq: number) => void): number {
      const boxID = boxObj.getBoxId();
      const data = { box_id: boxID } as MsgData;
      const eposmsg = MessageFactory.getCloseCommBoxMessage(data);

    try {
        if (!this.isOpened(boxID)) {
        callback?.(this.ERROR_NOT_OPENED, eposmsg.sequence);
        return eposmsg.sequence;
      }

      this.connection?.emit(eposmsg);
    } catch (error) {
      callback?.(this.ERROR_PARAMETER_ERROR, eposmsg.sequence);
    }

    if (callback) this.callbackInfo.addCallback(callback, eposmsg.sequence);

    return eposmsg.sequence;
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
      throw new Error(`CommBox ${box_id} no encontrado.`);
    }
    
    const method = `client_${type}` as keyof CommBox;
    if (typeof commBox[method] !== "function") {
      throw new Error(`Método ${method} no encontrado en CommBox.`);
    }

    try {
      const myFunc = commBox[method] as (data: any, sq: number) => void;
      myFunc(data, sq);
    } catch (error) {
      throw new Error(`Error al ejecutar ${method} in commbox ${box_id}.`);
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
