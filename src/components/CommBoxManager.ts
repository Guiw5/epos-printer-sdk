import { CommBox } from './CommBox';
import { CallbackInfo } from './CallbackInfo';
import { MessageFactory } from './MessageFactory';
import { Connection } from './Connection';

export class CommBoxManager {
  public ERROR_OK: string = 'OK';
  public ERROR_BOX_COUNT_OVER: string = 'BOX_COUNT_OVER';
  public ERROR_BOX_CLIENT_OVER: string = 'BOX_CLIENT_OVER';
  public ERROR_MEMBERID_ALREADY_USED: string = 'MEMBERID_ALREADY_USED';
  public ERROR_ALREADY_OPENED: string = 'ALREADY_OPENED';
  public ERROR_NOT_OPENED: string = 'NOT_OPENED';
  public ERROR_PARAMETER_ERROR: string = 'PARAMETER_ERROR';
  public ERROR_SYSTEM_ERROR: string = 'SYSTEM_ERROR';

  private callbackInfo: CallbackInfo;
  private commBoxList: Array<CommBox> = [];
  private connectionObj: Connection | null;

  constructor() {
    this.callbackInfo = new CallbackInfo();
    this.connectionObj = null;
  }

  public setConnectionObject(connectionObj: any): void {
    this.connectionObj = connectionObj;
  }

  public getConnectionObject(): any { 
    return this.connectionObj;
  }

  public openCommBox(boxID: string, option?: { memberID?: string }): Promise<CommBox> {
    return new Promise((resolve, reject) => {
      const memberID = option?.memberID || '';
      const data = {
        box_id: boxID,
        member_id: memberID,
      };
      const eposmsg = MessageFactory.getOpenCommBoxMessage(data);

      if (!this.connectionObj.isUsableDeviceIF()) {
        return reject({ error: this.ERROR_SYSTEM_ERROR, sequence: eposmsg.sequence });
      }

      this.connectionObj.emit(eposmsg);
      this.callbackInfo.addCallback((commBox: CommBox, code: string) => {
        if (code === this.ERROR_OK) {
          resolve(commBox);
        } else {
          reject({ error: code });
        }
      }, eposmsg.sequence);
    });
  }

  public closeCommBox(boxObj: CommBox): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const boxID = boxObj.getBoxId();
        const data = { box_id: boxID };
        const eposmsg = MessageFactory.getCloseCommBoxMessage(data);

        if (!this.isOpened(boxID)) {
          return reject({ error: this.ERROR_NOT_OPENED, sequence: eposmsg.sequence });
        }

        this.connectionObj!.emit(eposmsg);
        this.callbackInfo.addCallback(resolve, eposmsg.sequence);
      } catch (e) {
        return reject({ error: this.ERROR_PARAMETER_ERROR });
      }
    });
  }

  public client_opencommbox(data: any, sq: string): void {
    const boxID = data.box_id;
    const code = data.code;
    let commBoxObj: CommBox | null = null;

    if (code === this.ERROR_OK && this.getCommBox(boxID) == null) {
      commBoxObj = new CommBox(boxID, this, this.callbackInfo);
      this.commBoxList.push(commBoxObj);
    }

    const openCommBoxCB = this.callbackInfo.getCallback(sq);
    this.callbackInfo.removeCallback(sq);

    if (openCommBoxCB) {
      openCommBoxCB(commBoxObj, code, sq);
    }
  }

  public client_closecommbox(data: any, sq: string): void {
    const boxID = data.box_id;
    const code = data.code;
    this.removeCommBox(boxID);

    const closeCommBoxCB = this.callbackInfo.getCallback(sq);
    this.callbackInfo.removeCallback(sq);

    if (closeCommBoxCB) {
      closeCommBoxCB(code, sq);
    }
  }

  public executeCommDataCallback(data: any, sq: string): void {
    const boxID = data.box_id;
    const commBoxObj = this.getCommBox(boxID);
    const method = `client_${data.type}`;
    
    if (commBoxObj && typeof (commBoxObj as any)[method] === 'function') {
      (commBoxObj as any)[method](data, sq);
    } else {
      throw new Error('Method not found');
    }
  }

  public getCommBox(boxID: string): CommBox | null {
    return this.commBoxList.find(box => box.getBoxId() === boxID) || null;
  }

  public removeCommBox(boxID: string): boolean {
    const index = this.commBoxList.findIndex(box => box.getBoxId() === boxID);

    if (index > -1) {
      this.commBoxList.splice(index, 1);
      return true;
    }
    
    return false;
  }

  public isOpened(boxID: string): boolean {
    return this.commBoxList.some(box => box.getBoxId() === boxID);
  }
}
