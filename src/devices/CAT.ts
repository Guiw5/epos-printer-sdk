import { Connection } from "../components/Connection";
import { MessageFactory } from "../components/MessageFactory";
import type { DeviceRequest } from "../components/ePosDeviceMessage";

/**
 * A value carried by the CAT protocol. Neither the vendor bundle nor the
 * ePOS-Device XML manual (the CAT messages are absent from it) says whether
 * amounts and identifiers travel as text or as numbers, and there is no
 * terminal here to check against, so both are accepted.
 */
export type CatValue = string | number;

/**
 * Every field below is optional on purpose: the names come from the vendor
 * code, but which of them a given terminal fills in, and when, is only knowable
 * against real hardware.
 */
export interface CatTransactionParams {
  service?: CatValue;
  totalAmount?: CatValue;
  amount?: CatValue;
  tax?: CatValue;
  sequence?: CatValue;
  additionalSecurityInformation?: CatValue;
}

export interface CatDailyLogParams {
  service?: CatValue;
  totalAmount?: CatValue;
  sequence?: CatValue;
  dailylogType?: CatValue;
  additionalSecurityInformation?: CatValue;
}

export interface CatCommandParams {
  service?: CatValue;
  command?: CatValue;
  data?: CatValue;
  string?: CatValue;
  additionalSecurityInformation?: CatValue;
}

export interface CatCheckConnectionParams {
  additionalSecurityInformation?: CatValue;
}

export interface CatCashDepositParams {
  service?: CatValue;
  amount?: CatValue;
  sequence?: CatValue;
}

/** Raw response payload, with the names the service sends. */
export interface CatResponseData {
  status?: number;
  sequence?: CatValue;
  service?: CatValue;
  command?: CatValue;
  data?: CatValue;
  string?: CatValue;
  account_number?: CatValue;
  settled_amount?: CatValue;
  slip_number?: CatValue;
  kid?: CatValue;
  approval_code?: CatValue;
  transaction_number?: CatValue;
  payment_condition?: CatValue;
  void_slip_number?: CatValue;
  balance?: CatValue;
  transaction_type?: CatValue;
  additional_security_information?: CatValue;
  daily_log?: CatDailyLogEntryData[];
}

export interface CatDailyLogEntryData {
  kid?: CatValue;
  sales_count?: CatValue;
  sales_amount?: CatValue;
  void_count?: CatValue;
  void_amount?: CatValue;
}

/** The same payload, with the names the callbacks receive. */
export interface CatResult {
  status?: number;
  sequence?: CatValue;
  service?: CatValue;
  accountNumber?: CatValue;
  settledAmount?: CatValue;
  slipNumber?: CatValue;
  kid?: CatValue;
  approvalCode?: CatValue;
  transactionNumber?: CatValue;
  paymentCondition?: CatValue;
  voidSlipNumber?: CatValue;
  balance?: CatValue;
  transactionType?: CatValue;
  additionalSecurityInformation?: CatValue;
}

export interface CatDailyLogEntry {
  kid?: CatValue;
  salesCount?: CatValue;
  salesAmount?: CatValue;
  voidCount?: CatValue;
  voidAmount?: CatValue;
}

export interface CatDailyLogResult {
  status?: number;
  service?: CatValue;
  sequence?: CatValue;
  dailyLog: CatDailyLogEntry[];
}

export interface CatCommandReply {
  status?: number;
  command?: CatValue;
  data?: CatValue;
  string?: CatValue;
  service?: CatValue;
  sequence?: CatValue;
  accountNumber?: CatValue;
  settledAmount?: CatValue;
  slipNumber?: CatValue;
  transactionNumber?: CatValue;
  paymentCondition?: CatValue;
  balance?: CatValue;
  additionalSecurityInformation?: CatValue;
}

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

  send(data: DeviceRequest): number {
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
  authorizeSales(data: CatTransactionParams): number {
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

  authorizeVoid(data: CatTransactionParams): number {
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

  authorizeRefund(data: CatTransactionParams): number {
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

  authorizeCompletion(data: CatTransactionParams): number {
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

  accessDailyLog(data: CatDailyLogParams): number {
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

  sendCommand(data: CatCommandParams): number {
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

  checkConnection(data: CatCheckConnectionParams): number {
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

  scanData(data: Record<string, unknown>): number {
    const _timeout = this.timeout === 0 ? 150000 : this.timeout;
    return this.send({ type: "scandata", training: this.trainingMode, timeout: _timeout, ...data });
  }

  cashDeposit(data: CatCashDepositParams): number {
    return this.send({
      service: data.service,
      amount: data.amount,
      sequence: data.sequence,
      type: "cashdeposit",
      training: this.trainingMode,
      timeout: this.timeout
    });
  }

  client_onauthorizesales(data: CatResponseData): void {
    this.onauthorizesales?.(this.getResultObject(data));
  }

  client_onauthorizevoid(data: CatResponseData): void {
    this.onauthorizevoid?.(this.getResultObject(data));
  }

  client_onauthorizerefund(data: CatResponseData): void {
    this.onauthorizerefund?.(this.getResultObject(data));
  }

  client_onauthorizecompletion(data: CatResponseData): void {
    this.onauthorizecompletion?.(this.getResultObject(data));
  }

  client_onaccessdailylog(data: CatResponseData): void {
    this.onaccessdailylog?.(this.getDailyLogObject(data));
  }

  client_oncommandreply(data: CatResponseData): void {
    this.oncommandreply?.(this.getCommandReplyObject(data));
  }

  client_oncheckconnection(data: unknown): void {
    this.oncheckconnection?.(data);
  }

  client_onclearoutput(data: unknown): void {
    this.onclearoutput?.(data);
  }

  client_onscancode(data: unknown): void {
    this.onscancode?.(data);
  }

  client_onscandata(data: unknown): void {
    this.onscandata?.(data);
  }

  client_ondirectio(data: unknown): void {
    this.ondirectio?.(data);
  }

  client_onstatusupdate(data: unknown): void {
    this.onstatusupdate?.(data);
  }

  client_oncashdeposit(data: CatResponseData): void {
    this.oncashdeposit?.(this.getResultObject(data));
  }

  private getResultObject(data: CatResponseData): CatResult {
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

  private getDailyLogObject(data: CatResponseData): CatDailyLogResult {
    return {
      status: data.status,
      service: data.service,
      sequence: data.sequence,
      dailyLog: data.daily_log?.map((log) => ({
        kid: log.kid,
        salesCount: log.sales_count,
        salesAmount: log.sales_amount,
        voidCount: log.void_count,
        voidAmount: log.void_amount
      })) ?? []
    };
  }

  private getCommandReplyObject(data: CatResponseData): CatCommandReply {
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
  onauthorizesales?: (data: CatResult) => void;
  onauthorizevoid?: (data: CatResult) => void;
  onauthorizerefund?: (data: CatResult) => void;
  onauthorizecompletion?: (data: CatResult) => void;
  onaccessdailylog?: (data: CatDailyLogResult) => void;
  oncommandreply?: (data: CatCommandReply) => void;
  oncheckconnection?: (data: unknown) => void;
  onclearoutput?: (data: unknown) => void;
  onscancode?: (data: unknown) => void;
  onscandata?: (data: unknown) => void;
  ondirectio?: (data: unknown) => void;
  onstatusupdate?: (data: unknown) => void;
  oncashdeposit?: (data: CatResult) => void;
}
