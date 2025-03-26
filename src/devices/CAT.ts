import { Connection } from "../components/Connection";
import { MessageFactory } from "../components/MessageFactory";

export class CAT {
  readonly SUE_LOGSTATUS_OK = 0;
  readonly SUE_LOGSTATUS_NEARFULL = 1;
  readonly SUE_LOGSTATUS_FULL = 2;
  readonly SUE_POWER_ONLINE = 2001;
  readonly SUE_POWER_OFF_OFFLINE = 2004;

  private deviceID: string;
  private isCrypto: boolean;
  private timeout: number = 0;
  private trainingMode: boolean = false;
  private connection: Connection | null = null;

  constructor(deviceID: string, isCrypto: boolean, connection?: Connection) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connection = connection ?? null;
  }

  setConnection(connection: Connection): void {
    this.connection = connection;
  }

  send(data: any): number {
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
  authorizeSales(data: any): number {
    const _data = {
      service: data.service,
      total_amount: data.totalAmount,
      amount: data.amount,
      tax: data.tax,
      sequence: data.sequence,
      additional_security_information: data.additionalSecurityInformation,
      type: "authorizesales",
      training: this.trainingMode,
      timeout: this.timeout
    };
    return this.send(_data);
  }

  authorizeVoid(data: any): number {
    const _data = {
      service: data.service,
      total_amount: data.totalAmount,
      amount: data.amount,
      tax: data.tax,
      sequence: data.sequence,
      additional_security_information: data.additionalSecurityInformation,
      type: "authorizevoid",
      training: this.trainingMode,
      timeout: this.timeout
    };
    return this.send(_data);
  }

  authorizeRefund(data: any): number {
    const _data = {
      service: data.service,
      total_amount: data.totalAmount,
      amount: data.amount,
      tax: data.tax,
      sequence: data.sequence,
      additional_security_information: data.additionalSecurityInformation,
      type: "authorizerefund",
      training: this.trainingMode,
      timeout: this.timeout
    };
    return this.send(_data);
  }

  authorizeCompletion(data: any): number {
    const _data = {
      service: data.service,
      total_amount: data.totalAmount,
      amount: data.amount,
      tax: data.tax,
      sequence: data.sequence,
      additional_security_information: data.additionalSecurityInformation,
      type: "authorizecompletion",
      training: this.trainingMode,
      timeout: this.timeout
    };
    return this.send(_data);
  }

  accessDailyLog(data: any): number {
    const _data = {
      service: data.service,
      total_amount: data.totalAmount,
      sequence: data.sequence,
      dailylog_type: data.dailylogType,
      additional_security_information: data.additionalSecurityInformation,
      type: "accessdailylog",
      training: this.trainingMode,
      timeout: this.timeout
    };
    return this.send(_data);
  }

  sendCommand(data: any): number {
    const _data = {
      service: data.service,
      command: data.command,
      data: data.data,
      string: data.string,
      additional_security_information: data.additionalSecurityInformation,
      type: "sendcommand",
      training: this.trainingMode
    };
    return this.send(_data);
  }

  checkConnection(data: any): number {
    const _data = {
      type: "checkconnection",
      additional_security_information: data.additionalSecurityInformation,
      timeout: this.timeout
    };
    return this.send(_data);
  }

  clearOutput(): number {
    return this.send({ type: "clearoutput" });
  }

  scanCode(): number {
    const _timeout = this.timeout === 0 ? 60000 : this.timeout;
    return this.send({ type: "scancode", training: this.trainingMode, timeout: _timeout });
  }

  scanData(data: any): number {
    const _timeout = this.timeout === 0 ? 150000 : this.timeout;
    return this.send({ type: "scandata", training: this.trainingMode, timeout: _timeout, ...data });
  }

  cashDeposit(data: any): number {
    return this.send({
      service: data.service,
      amount: data.amount,
      sequence: data.sequence,
      type: "cashdeposit",
      training: this.trainingMode,
      timeout: this.timeout
    });
  }

  client_onauthorizesales(data: any): void {
    this.onauthorizesales?.(this.getResultObject(data));
  }

  client_onauthorizevoid(data: any): void {
    this.onauthorizevoid?.(this.getResultObject(data));
  }

  client_onauthorizerefund(data: any): void {
    this.onauthorizerefund?.(this.getResultObject(data));
  }

  client_onauthorizecompletion(data: any): void {
    this.onauthorizecompletion?.(this.getResultObject(data));
  }

  client_onaccessdailylog(data: any): void {
    this.onaccessdailylog?.(this.getDailyLogObject(data));
  }

  client_oncommandreply(data: any): void {
    this.oncommandreply?.(this.getCommandReplyObject(data));
  }

  client_oncheckconnection(data: any): void {
    this.oncheckconnection?.(data);
  }

  client_onclearoutput(data: any): void {
    this.onclearoutput?.(data);
  }

  client_onscancode(data: any): void {
    this.onscancode?.(data);
  }

  client_onscandata(data: any): void {
    this.onscandata?.(data);
  }

  client_ondirectio(data: any): void {
    this.ondirectio?.(data);
  }

  client_onstatusupdate(data: any): void {
    this.onstatusupdate?.(data);
  }

  client_oncashdeposit(data: any): void {
    this.oncashdeposit?.(this.getResultObject(data));
  }

  private getResultObject(data: any): Record<string, any> {
    return {
      status: data.status,
      sequence: data.sequence,
      service: data.service,
      accountNumber: data.account_number,
      settledAmount: data.settled_amount,
      slipNumber: data.slip_number,
      kid: data.kid,
      approvalCode: data.approval_code,
      transactionNumber: data.transaction_number,
      paymentCondition: data.payment_condition,
      voidSlipNumber: data.void_slip_number,
      balance: data.balance,
      transactionType: data.transaction_type,
      additionalSecurityInformation: data.additional_security_information
    };
  }

  private getDailyLogObject(data: any): Record<string, any> {
    return {
      status: data.status,
      service: data.service,
      sequence: data.sequence,
      dailyLog: data.daily_log?.map((log: any) => ({
        kid: log.kid,
        salesCount: log.sales_count,
        salesAmount: log.sales_amount,
        voidCount: log.void_count,
        voidAmount: log.void_amount
      })) ?? []
    };
  }

  private getCommandReplyObject(data: any): Record<string, any> {
    return {
      status: data.status,
      command: data.command,
      data: data.data,
      string: data.string,
      service: data.service,
      sequence: data.sequence,
      accountNumber: data.account_number,
      settledAmount: data.settled_amount,
      slipNumber: data.slip_number,
      transactionNumber: data.transaction_number,
      paymentCondition: data.payment_condition,
      balance: data.balance,
      additionalSecurityInformation: data.additional_security_information
    };
  }

  // **Callback Properties**
  onauthorizesales?: (data: any) => void;
  onauthorizevoid?: (data: any) => void;
  onauthorizerefund?: (data: any) => void;
  onauthorizecompletion?: (data: any) => void;
  onaccessdailylog?: (data: any) => void;
  oncommandreply?: (data: any) => void;
  oncheckconnection?: (data: any) => void;
  onclearoutput?: (data: any) => void;
  onscancode?: (data: any) => void;
  onscandata?: (data: any) => void;
  ondirectio?: (data: any) => void;
  onstatusupdate?: (data: any) => void;
  oncashdeposit?: (data: any) => void;
}