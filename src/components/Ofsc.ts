import { Connection } from "./Connection";
import { Data, MsgData } from "./ePosDeviceMessage";
import { MessageFactory } from "./MessageFactory";

export class Ofsc {
  private readonly SERVICE_ID = "OFSC";
  private connection: Connection | null = null;

  private callback: ((xml: string) => void) | null = null;
  /**
   * Sets the connection object for communication.
   * @param connection - The connection object to use.
   */
  public setConnection(connection: Connection): void {
    this.connection = connection;
  }

  /**
   * Sends a request and returns the result via a Promise.
   * @param xml - The XML data to send.
   * @param timeout - Timeout duration for the request.
   * @param crypto - Whether encryption is required.
   * @returns A Promise resolving with the response data.
   */
  public send(xml: string, timeout: number, crypto: boolean, callback: (xml: string) => void): void {
    this.callback = callback;
    if (!this.connection) {
      throw new Error("Connection object is not set");
    }

    if (!this.connection.isUsableDeviceIF()) {
      throw new Error("Device interface is not usable");
    }

    try {
      const data = { type: "print", timeout, printdata: xml } as MsgData;
      const eposmsg = MessageFactory.getServiceMessage(this.SERVICE_ID, crypto, data);
      this.connection.emit(eposmsg);
    } catch (e) {
      console.error('Error in Ofsc socket', e)
      return;
    }
  };

  /**
   * Handles incoming messages and resolves the corresponding request.
   * @param eposmsg - The received message.
   */
  public notify(eposmsg: { isCrypto: string | boolean; data: Data }): void {
    const isCrypto = eposmsg.isCrypto === "1" || Boolean(eposmsg.isCrypto);
    // The OFSC reply carries its payload in `resultdata`, which is not part of
    // the device message shapes the rest of the protocol uses.
    const data = (isCrypto ? MessageFactory.decrypt(eposmsg.data as string) : eposmsg.data) as unknown as { resultdata: string };
    // console.log("Received data:", data);
    this.onxmlresult(data.resultdata)
  }

  /**
   * Processes XML results.
   * @param xml - The received XML data.
   */
  public onxmlresult(xml: string): void {
    if (this.callback){
      this.callback(xml);
    }
  }
}
