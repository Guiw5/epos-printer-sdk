/*! Epson ePOS SDK Version 2.27.0 Copyright(C) Seiko Epson Corporation 2016 - 2023 All rights reserved. */
(function(window, undefined) {
  function callbackInfo() {
    this.callbackInfoList = new Object()
  }
  callbackInfo.prototype = {
    addCallback: function(callback, sq) {
      this.callbackInfoList[sq] = callback
    },
    removeCallback: function(sq) {
      for (var i in this.callbackInfoList) {
        if (i == sq) {
          delete this.callbackInfoList[i];
          return
        }
      }
    },
    getCallback: function(sq) {
      if (this.callbackInfoList[sq] != null) {
        return this.callbackInfoList[sq]
      }
      return null
    }
  };

  function CommBox(boxID, commBoxManager, callbackInfo) {
    this.ERROR_OK = "OK";
    this.ERROR_NOT_OPENED = "NOT_OPENED";
    this.ERROR_MEMBER_NOT_FOUND = "MEMBER_NOT_FOUND";
    this.ERROR_SYSTEM_ERROR = "SYSTEM_ERROR";
    this.boxID = boxID;
    this.commBoxManager = commBoxManager;
    this.callbackInfo = callbackInfo;
    this.onreceive = null;
    this.connectionObj = this.commBoxManager.connectionObj
  }
  CommBox.prototype = {
    getCommHistory: function(option, callback) {
      var _option = (typeof(option) == "function") ? null : option;
      var _callback = (typeof(option) == "function") ? option : callback;
      var allHistory = ((_option == null) || (_option.allHistory == null)) ? false : option.allHistory;
      var data = {
        type: "getcommhistory",
        box_id: this.boxID,
        all_history: allHistory
      };
      var eposmsg = MessageFactory.getCommBoxDataMessage(data);
      if (!this.commBoxManager.isOpened(this.getBoxId())) {
        if (_callback != null) {
          _callback(this.ERROR_NOT_OPENED, null, eposmsg.sequence)
        }
        return eposmsg.sequence
      }
      this.callbackInfo.addCallback(_callback, eposmsg.sequence);
      this.connectionObj.emit(eposmsg);
      return eposmsg.sequence
    },
    send: function(message, memberID, callback) {
      var data = {
        type: "send",
        box_id: this.boxID,
        message: message,
        member_id: memberID
      };
      var eposmsg = MessageFactory.getCommBoxDataMessage(data);
      if (!this.commBoxManager.isOpened(this.getBoxId())) {
        if (callback != null) {
          callback(this.ERROR_NOT_OPENED, 0, eposmsg.sequence)
        }
        return eposmsg.sequence
      }
      this.callbackInfo.addCallback(callback, eposmsg.sequence);
      this.connectionObj.emit(eposmsg);
      return eposmsg.sequence
    },
    client_getcommhistory: function(data, sq) {
      var code = data.code;
      var historyList = data.history_list;
      var getCommHistoryCB = this.callbackInfo.getCallback(sq);
      this.callbackInfo.removeCallback(sq);
      if (getCommHistoryCB != null) {
        getCommHistoryCB(code, historyList, sq)
      }
      return
    },
    client_send: function(data, sq) {
      var code = data.code;
      var count = data.count;
      var sendCB = this.callbackInfo.getCallback(sq);
      this.callbackInfo.removeCallback(sq);
      if (sendCB != null) {
        sendCB(code, count, sq)
      }
      return
    },
    client_onreceive: function(data, sq) {
      var rcvData = new Object();
      rcvData.senderId = data.sender_id;
      rcvData.receiverId = data.receiver_id;
      rcvData.message = data.message;
      if (this.onreceive != null) {
        this.onreceive(rcvData)
      }
      return
    },
    getBoxId: function() {
      return this.boxID
    }
  };

  function CommBoxManager() {
    this.ERROR_OK = "OK";
    this.ERROR_BOX_COUNT_OVER = "BOX_COUNT_OVER";
    this.ERROR_BOX_CLIENT_OVER = "BOX_CLIENT_OVER";
    this.ERROR_MEMBERID_ALREADY_USED = "MEMBERID_ALREADY_USED";
    this.ERROR_ALREADY_OPENED = "ALREADY_OPENED";
    this.ERROR_NOT_OPENED = "NOT_OPENED";
    this.ERROR_PARAMETER_ERROR = "PARAMETER_ERROR";
    this.ERROR_SYSTEM_ERROR = "SYSTEM_ERROR";
    this.callbackInfo = new callbackInfo();
    this.commBoxList = new Array();
    this.connectionObj = null
  }
  CommBoxManager.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    openCommBox: function(boxID, option, callback) {
      var memberID = "";
      if (option != null && option.memberID != null) {
        memberID = option.memberID
      }
      var data = {
        box_id: boxID,
        member_id: memberID
      };
      var eposmsg = MessageFactory.getOpenCommBoxMessage(data);
      if (!this.connectionObj.isUsableDeviceIF()) {
        callback(null, this.ERROR_SYSTEM_ERROR, eposmsg.sequence);
        return eposmsg.sequence
      }
      this.connectionObj.emit(eposmsg);
      this.callbackInfo.addCallback(callback, eposmsg.sequence);
      return eposmsg.sequence
    },
    closeCommBox: function(boxObj, callback) {
      var data = {
        box_id: boxID
      };
      var eposmsg = MessageFactory.getCloseCommBoxMessage(data);
      try {
        var boxID = boxObj.getBoxId();
        data.box_id = boxID;
        eposmsg = MessageFactory.getCloseCommBoxMessage(data);
        if (!this.isOpened(boxID)) {
          if (callback != null) {
            callback(this.ERROR_NOT_OPENED, eposmsg.sequence)
          }
          return eposmsg.sequence
        }
        this.connectionObj.emit(eposmsg)
      } catch (e) {
        if (callback != null) {
          callback(this.ERROR_PARAMETER_ERROR, eposmsg.sequence)
        }
      }
      this.callbackInfo.addCallback(callback, eposmsg.sequence);
      return eposmsg.sequence
    },
    client_opencommbox: function(data, sq) {
      var boxID = data.box_id;
      var code = data.code;
      var commBoxObj = null;
      if (code == this.ERROR_OK && this.getCommBox(boxID) == null) {
        commBoxObj = new CommBox(boxID, this, this.callbackInfo)
      }
      if (commBoxObj != null) {
        this.commBoxList.push(commBoxObj)
      }
      var openCommBoxCB = this.callbackInfo.getCallback(sq);
      this.callbackInfo.removeCallback(sq);
      if (openCommBoxCB != null) {
        openCommBoxCB(commBoxObj, code, sq)
      }
      return
    },
    client_closecommbox: function(data, sq) {
      var boxID = data.box_id;
      var code = data.code;
      this.removeCommBox(boxID);
      var closeCommBoxCB = this.callbackInfo.getCallback(sq);
      this.callbackInfo.removeCallback(sq);
      if (closeCommBoxCB != null) {
        closeCommBoxCB(code, sq)
      }
      return
    },
    executeCommDataCallback: function(data, sq) {
      var boxID = data.box_id;
      var commBoxObj = this.getCommBox(boxID);
      var method = "client_" + data.type;
      try {
        eval("commBoxObj." + method + "(data, sq)")
      } catch (e) {
        throw new Error("")
      }
      return
    },
    getCommBox: function(boxID) {
      var commBoxObj = null;
      for (var i = 0; i < this.commBoxList.length; i++) {
        if (this.commBoxList[i].getBoxId() == boxID) {
          commBoxObj = this.commBoxList[i];
          break
        }
      }
      return commBoxObj
    },
    removeCommBox: function(boxID) {
      var result = false;
      for (var i = 0; i < this.commBoxList.length; i++) {
        if (this.commBoxList[i].getBoxId() == boxID) {
          this.commBoxList.splice(i, 1);
          result = true;
          break
        }
      }
      return result
    },
    isOpened: function(boxID) {
      var result = false;
      for (var i = 0; i < this.commBoxList.length; i++) {
        if (this.commBoxList[i].getBoxId() == boxID) {
          result = true;
          break
        }
      }
      return result
    }
  };

  function DeviceObjectSelector() {
    this.type2objectMap = {
      type_scanner: "Scanner",
      type_keyboard: "Keyboard",
      type_poskeyboard: "POSKeyboard",
      type_msr: "MSR",
      type_cat: "CAT",
      type_cash_changer: "CashChanger",
      type_printer: "Printer",
      type_display: "Display",
      type_simple_serial: "SimpleSerial",
      type_hybrid_printer: "HybridPrinter",
      type_hybrid_printer2: "HybridPrinter2",
      type_dt: "DeviceTerminal",
      type_other_peripheral: "OtherPeripheral",
      type_storage: "GermanyFiscalElement"
    };
    this.connectionObj = null
  }
  DeviceObjectSelector.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    isSelectable: function(deviceType) {
      if (this.connectionObj.isUsableDeviceIF()) {
        return true
      } else {
        if (deviceType == "type_printer" && this.connectionObj.isUsablePrintIF()) {
          return true
        } else {
          if (deviceType == "type_display" && this.connectionObj.isUsableDisplayIF()) {
            return true
          }
        }
      }
      return false
    },
    select: function(deviceId, deviceType, specificDevice, isCrypto, ePOSDeviceContext) {
      var deviceObjectName = "";
      if (typeof(specificDevice) == "string") {
        deviceObjectName = specificDevice
      } else {
        deviceObjectName = this.type2objectMap[deviceType]
      }
      var templateObject = null;
      try {
        templateObject = eval(deviceObjectName)
      } catch (e) {
        throw new Error("ERROR_PARAMETER")
      }
      if (typeof(templateObject) != "function") {
        throw new Error("ERROR_PARAMETER")
      }
      if ((deviceObjectName == "Printer") || (deviceObjectName == "Display") || (deviceObjectName == "HybridPrinter") || (deviceObjectName == "HybridPrinter2")) {
        return new templateObject(deviceId, isCrypto, ePOSDeviceContext)
      } else {
        return new templateObject(deviceId, isCrypto)
      }
    }
  };

  function CashChanger(deviceID, isCrypto) {
    this.CONFIG_LEFT_CASH = "CONFIG_LEFT_CASH";
    this.CONFIG_COUNT_MODE = "CONFIG_COUNT_MODE";
    this.MODE_MANUAL_INPUT = "MODE_MANUAL_INPUT";
    this.MODE_AUTOCOUNT = "MODE_AUTO_COUNT";
    this.DEPOSIT_CHANGE = "DEPOSIT_CHANGE";
    this.DEPOSIT_NOCHANGE = "DEPOSIT_NOCHANGE";
    this.DEPOSIT_REPAY = "DEPOSIT_REPAY";
    this.COLLECT_ALL_CASH = "ALL_CASH";
    this.COLLECT_PART_OF_CASH = "PART_OF_CASH";
    this.SUE_POWER_ONLINE = 2001;
    this.SUE_POWER_OFF = 2002;
    this.SUE_POWER_OFFLINE = 2003;
    this.SUE_POWER_OFF_OFFLINE = 2004;
    this.SUE_STATUS_EMPTY = 11;
    this.SUE_STATUS_NEAREMPTY = 12;
    this.SUE_STATUS_EMPTYOK = 13;
    this.SUE_STATUS_FULL = 21;
    this.SUE_STATUS_NEARFULL = 22;
    this.SUE_STATUS_FULLOK = 23;
    this.SUE_STATUS_JAM = 31;
    this.SUE_STATUS_JAMOK = 32;
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connectionObj = null
  }
  CashChanger.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    client_oncashcounts: function(data) {
      try {
        if (this.oncashcounts == null) {
          return
        }
        this.oncashcounts(data)
      } catch (e) {}
      return
    },
    client_onstatuschange: function(data) {
      try {
        if (this.onstatuschange == null) {
          return
        }
        this.onstatuschange(data)
      } catch (e) {}
      return
    },
    client_ondeposit: function(data) {
      try {
        if (this.ondeposit == null) {
          return
        }
        this.ondeposit(data)
      } catch (e) {}
      return
    },
    client_ondispense: function(data) {
      try {
        if (this.ondispense == null) {
          return
        }
        this.ondispense(data)
      } catch (e) {}
      return
    },
    client_oncollect: function(data) {
      try {
        if (this.oncollect == null) {
          return
        }
        this.oncollect(data)
      } catch (e) {}
      return
    },
    client_onconfigchange: function(data) {
      try {
        if (this.onconfigchange == null) {
          return
        }
        this.onconfigchange(data)
      } catch (e) {}
      return
    },
    client_oncommandreply: function(data) {
      try {
        if (this.oncommandreply == null) {
          return
        }
        if (typeof data.command != "") {} else {
          var hexData = data.data;
          hexData = hexData.replace(/[0-9a-fA-F]{2}/g, function(c) {
            var hexNum = parseInt(c, 16);
            return String.fromCharCode(hexNum)
          });
          data.data = hexData
        }
        this.oncommandreply(data)
      } catch (e) {}
      return
    },
    client_ondirectio: function(data) {
      try {
        if (this.ondirectio == null) {
          return
        }
        this.ondirectio(data)
      } catch (e) {}
      return
    },
    client_onstatusupdate: function(data) {
      try {
        if (this.onstatusupdate == null) {
          return
        }
        this.onstatusupdate(data)
      } catch (e) {}
      return
    },
    readCashCounts: function() {
      var data = {
        type: "readcashcounts"
      };
      return this.send(data)
    },
    beginDeposit: function() {
      var data = {
        type: "begindeposit"
      };
      return this.send(data)
    },
    pauseDeposit: function() {
      var data = {
        type: "pausedeposit"
      };
      return this.send(data)
    },
    restartDeposit: function() {
      var data = {
        type: "restartdeposit"
      };
      return this.send(data)
    },
    endDeposit: function(cmd) {
      var data = {
        type: "enddeposit",
        cmd: cmd
      };
      return this.send(data)
    },
    dispenseCash: function(data) {
      var data_;
      if (typeof data == "object") {
        data_ = data;
        data_.type = "dispensecash"
      } else {
        data_ = {
          type: "dispensecash",
          cash: data
        }
      }
      return this.send(data_)
    },
    dispenseChange: function(cash) {
      var data_;
      if (typeof cash == "object") {
        data_ = cash;
        data_.type = "dispensechange"
      } else {
        data_ = {
          type: "dispensechange",
          cash: cash
        }
      }
      return this.send(data_)
    },
    openDrawer: function() {
      var data = {
        type: "opendrawer"
      };
      return this.send(data)
    },
    collectCash: function(collectMode) {
      var data = {
        type: "collectcash",
        collectmode: collectMode
      };
      return this.send(data)
    },
    setConfig: function(config, value) {
      var data = null;
      switch (config) {
        case this.CONFIG_COUNT_MODE:
          data = {
            type: "setconfig",
            config: config,
            mode: value.mode
          };
          break;
        case this.CONFIG_LEFT_CASH:
          if ((value.bills == null) || (value.bills == "")) {
            value.bills = "0"
          }
          if ((value.coins == null) || (value.coins == "")) {
            value.coins = "0"
          }
          data = {
            type: "setconfig",
            config: config,
            bills: value.bills,
            coins: value.coins
          };
          break;
        default:
          break
      }
      var sq = -1;
      if (data != null) {
        sq = this.send(data)
      }
      return sq
    },
    sendCommand: function(command) {
      var data;
      if (typeof command == "object") {
        data = command;
        data.type = "sendcommand"
      } else {
        data = {
          type: "sendcommand",
          command: toHexBinary(command)
        }
      }
      return this.send(data)
    },
    callEvent: function(eventName, data) {
      var eventReq = data;
      eventReq.type = eventName;
      return this.send(eventReq)
    },
    send: function(data) {
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    }
  };

  function CAT(deviceID, isCrypto) {
    this.SUE_LOGSTATUS_OK = 0;
    this.SUE_LOGSTATUS_NEARFULL = 1;
    this.SUE_LOGSTATUS_FULL = 2;
    this.SUE_POWER_ONLINE = 2001;
    this.SUE_POWER_OFF_OFFLINE = 2004;
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.timeout = 0;
    this.trainingMode = false;
    this.connectionObj = null
  }
  CAT.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    authorizeSales: function(data) {
      var _data = {
        service: data.service,
        total_amount: data.totalAmount,
        amount: data.amount,
        tax: data.tax,
        sequence: data.sequence,
        additional_security_information: data.additionalSecurityInformation
      };
      _data.type = "authorizesales";
      _data.training = this.trainingMode;
      _data.timeout = this.timeout;
      return this.send(_data)
    },
    authorizeVoid: function(data) {
      var _data = {
        service: data.service,
        total_amount: data.totalAmount,
        amount: data.amount,
        tax: data.tax,
        sequence: data.sequence,
        additional_security_information: data.additionalSecurityInformation
      };
      _data.type = "authorizevoid";
      _data.training = this.trainingMode;
      _data.timeout = this.timeout;
      return this.send(_data)
    },
    authorizeRefund: function(data) {
      var _data = {
        service: data.service,
        total_amount: data.totalAmount,
        amount: data.amount,
        tax: data.tax,
        sequence: data.sequence,
        additional_security_information: data.additionalSecurityInformation
      };
      _data.type = "authorizerefund";
      _data.training = this.trainingMode;
      _data.timeout = this.timeout;
      return this.send(_data)
    },
    authorizeCompletion: function(data) {
      var _data = {
        service: data.service,
        total_amount: data.totalAmount,
        amount: data.amount,
        tax: data.tax,
        sequence: data.sequence,
        additional_security_information: data.additionalSecurityInformation
      };
      _data.type = "authorizecompletion";
      _data.training = this.trainingMode;
      _data.timeout = this.timeout;
      return this.send(_data)
    },
    accessDailyLog: function(data) {
      var _data = {
        service: data.service,
        total_amount: data.totalAmount,
        sequence: data.sequence,
        dailylog_type: data.dailylogType,
        additional_security_information: data.additionalSecurityInformation
      };
      _data.type = "accessdailylog";
      _data.training = this.trainingMode;
      _data.timeout = this.timeout;
      return this.send(_data)
    },
    sendCommand: function(data) {
      var _data = {
        service: data.service,
        command: data.command,
        data: data.data,
        string: data.string,
        additional_security_information: data.additionalSecurityInformation
      };
      _data.type = "sendcommand";
      _data.training = this.trainingMode;
      return this.send(_data)
    },
    checkConnection: function(data) {
      var _data = {
        type: "checkconnection",
        additional_security_information: data.additionalSecurityInformation
      };
      _data.timeout = this.timeout;
      return this.send(_data)
    },
    clearOutput: function() {
      var _data = {
        type: "clearoutput"
      };
      return this.send(_data)
    },
    scanCode: function() {
      var _timeout;
      if (this.timeout == 0) {
        _timeout = 60000
      } else {
        _timeout = this.timeout
      }
      var _data = {
        type: "scancode"
      };
      _data.training = this.trainingMode;
      _data.timeout = _timeout;
      return this.send(_data)
    },
    scanData: function(data) {
      var _timeout;
      if (this.timeout == 0) {
        _timeout = 150000
      } else {
        _timeout = this.timeout
      }
      var _data = {
        command: data.command,
        string: data.string
      };
      _data.type = "scandata";
      _data.training = this.trainingMode;
      _data.timeout = _timeout;
      return this.send(_data)
    },
    cashDeposit: function(data) {
      var _data = {
        service: data.service,
        amount: data.amount,
        sequence: data.sequence
      };
      _data.type = "cashdeposit";
      _data.training = this.trainingMode;
      _data.timeout = this.timeout;
      return this.send(_data)
    },
    send: function(data) {
      var tmp = this.deviceID;
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    },
    client_onauthorizesales: function(data) {
      try {
        if (this.onauthorizesales == null) {
          return
        }
        this.onauthorizesales(this.getResultObject(data))
      } catch (e) {}
      return
    },
    client_onauthorizevoid: function(data) {
      try {
        if (this.onauthorizevoid == null) {
          return
        }
        this.onauthorizevoid(this.getResultObject(data))
      } catch (e) {}
      return
    },
    client_onauthorizerefund: function(data) {
      try {
        if (this.onauthorizerefund == null) {
          return
        }
        this.onauthorizerefund(this.getResultObject(data))
      } catch (e) {}
      return
    },
    client_onauthorizecompletion: function(data) {
      try {
        if (this.onauthorizecompletion == null) {
          return
        }
        this.onauthorizecompletion(this.getResultObject(data))
      } catch (e) {}
      return
    },
    client_onaccessdailylog: function(data) {
      try {
        if (this.onaccessdailylog == null) {
          return
        }
        this.onaccessdailylog(this.getDailyLogObject(data))
      } catch (e) {}
      return
    },
    client_oncommandreply: function(data) {
      try {
        if (this.oncommandreply == null) {
          return
        }
        this.oncommandreply(this.getCommandReplyObject(data))
      } catch (e) {}
      return
    },
    client_oncheckconnection: function(data) {
      try {
        if (this.oncheckconnection == null) {
          return
        }
        this.oncheckconnection(data)
      } catch (e) {}
      return
    },
    client_onclearoutput: function(data) {
      try {
        if (this.onclearoutput == null) {
          return
        }
        this.onclearoutput(data)
      } catch (e) {}
      return
    },
    client_onscancode: function(data) {
      try {
        if (this.onscancode == null) {
          return
        }
        this.onscancode(data)
      } catch (e) {}
      return
    },
    client_onscandata: function(data) {
      try {
        if (this.onscandata == null) {
          return
        }
        this.onscandata(data)
      } catch (e) {}
      return
    },
    client_ondirectio: function(data) {
      try {
        if (this.ondirectio == null) {
          return
        }
        this.ondirectio(data)
      } catch (e) {}
      return
    },
    client_onstatusupdate: function(data) {
      try {
        if (this.onstatusupdate == null) {
          return
        }
        this.onstatusupdate(data)
      } catch (e) {}
      return
    },
    client_oncashdeposit: function(data) {
      try {
        if (this.oncashdeposit == null) {
          return
        }
        this.oncashdeposit(this.getResultObject(data))
      } catch (e) {}
      return
    },
    getResultObject: function(data) {
      return ({
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
      })
    },
    getDailyLogObject: function(data) {
      var dailylogData = {};
      dailylogData.status = data.status;
      dailylogData.service = data.service;
      dailylogData.sequence = data.sequence;
      var logList = [];
      try {
        data.daily_log.forEach(function(log) {
          var logData = {};
          if (log === 0) {
            throw logList
          }
          logData.kid = log.kid;
          logData.salesCount = log.sales_count;
          logData.salesAmount = log.sales_amount;
          logData.voidCount = log.void_count;
          logData.voidAmount = log.void_amount;
          logList.push(logData)
        })
      } catch (e) {}
      dailylogData.dailyLog = logList;
      return dailylogData
    },
    getCommandReplyObject: function(data) {
      return ({
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
        additionalSecurityInformation: data.additional_security_information,
      })
    },
    callEvent: function(eventName, data) {
      var eventReq = data;
      eventReq.type = eventName;
      return this.send(eventReq)
    }
  };

  function DeviceTerminal(deviceID, isCrypto) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.onshutdown = null;
    this.onrestart = null;
    this.connectionObj = null
  }
  DeviceTerminal.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    shutdown: function(password, callback) {
      this.onshutdown = callback;
      var data = {
        type: "shutdown",
        password: password
      };
      return this.send(data)
    },
    client_onshutdown: function(data) {
      try {
        if (typeof(this.onshutdown) != "function") {
          return
        }
        this.onshutdown(data)
      } catch (e) {}
      return
    },
    restart: function(password, callback) {
      this.onrestart = callback;
      var data = {
        type: "restart",
        password: password
      };
      return this.send(data)
    },
    client_onrestart: function(data) {
      try {
        if (typeof(this.onrestart) != "function") {
          return
        }
        this.onrestart(data)
      } catch (e) {}
      return
    },
    send: function(data) {
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    }
  };

  function Display(deviceID, isCrypto, ePOSDeviceContext) {
    this.message = "";
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.ePosDev = ePOSDeviceContext;
    this.timeout = 10000;
    this.onreceive = null;
    this.onerror = null;
    this.ASB_NO_RESPONSE = 1;
    this.ASB_DISPLAY_SUCCESS = 2;
    this.SCROLL_OVERWRITE = "overwrite";
    this.SCROLL_VERTICAL = "v_scroll";
    this.SCROLL_HORIZONTAL = "h_scroll";
    this.MOVE_TOP_LEFT = "top_left";
    this.MOVE_TOP_RIGHT = "top_right";
    this.MOVE_BOTTOM_LEFT = "bottom_left";
    this.MOVE_BOTTOM_RIGHT = "bottom_right";
    this.CURSOR_NONE = "none";
    this.CURSOR_UNDERLINE = "underline";
    this.BRIGHTNESS_20 = 20;
    this.BRIGHTNESS_40 = 40;
    this.BRIGHTNESS_60 = 60;
    this.BRIGHTNESS_100 = 100;
    this.MARQUEE_WALK = "walk";
    this.MARQUEE_PLACE = "place";
    this.connectionObj = null;
    this.LAYOUT_MODE_1 = 1;
    this.LAYOUT_MODE_2 = 2;
    this.LAYOUT_MODE_3 = 3;
    this.LAYOUT_MODE_4 = 4;
    this.LAYOUT_MODE_5 = 5;
    this.LAYOUT_MODE_6 = 6;
    this.LAYOUT_MODE_7 = 7;
    this.LAYOUT_MODE_8 = 8;
    this.LAYOUT_MODE_9 = 9;
    this.LAYOUT_MODE_10 = 10;
    this.LAYOUT_MODE_11 = 11;
    this.LAYOUT_MODE_12 = 12;
    this.LAYOUT_MODE_13 = 13;
    this.LAYOUT_MODE_14 = 14;
    this.LAYOUT_MODE_15 = 15;
    this.LANDSCAPE_LAYOUT_MODE_1 = 20;
    this.LANDSCAPE_LAYOUT_MODE_2 = 22;
    this.LANDSCAPE_LAYOUT_MODE_3 = 23;
    this.LANDSCAPE_LAYOUT_MODE_4 = 24;
    this.LANDSCAPE_LAYOUT_MODE_5 = 25;
    this.PORTRAIT_LAYOUT_MODE_1 = 21;
    this.PORTRAIT_LAYOUT_MODE_2 = 26;
    this.PORTRAIT_LAYOUT_MODE_3 = 27;
    this.PORTRAIT_LAYOUT_MODE_4 = 28;
    this.PORTRAIT_LAYOUT_MODE_5 = 29;
    this.PORTRAIT_LAYOUT_MODE_6 = 30;
    this.PORTRAIT_LAYOUT_MODE_7 = 31;
    this.EVEN_ROWS = "even";
    this.ODD_ROWS = "odd";
    this.ALL_ROWS = "all";
    this.SYMBOL_QRCODE_MODEL_1 = "qrcode_model_1";
    this.SYMBOL_QRCODE_MODEL_2 = "qrcode_model_2";
    this.LEVEL_L = "level_l";
    this.LEVEL_M = "level_m";
    this.LEVEL_Q = "level_q";
    this.LEVEL_H = "level_h";
    this.LEVEL_DEFAULT = "default"
  }
  Display.prototype.setConnectionObject = function(connectionObj) {
    this.connectionObj = connectionObj
  };
  Display.prototype.reset = function() {
    try {
      this.message += "<reset />"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.createWindow = function(number, x, y, width, hight, scrollMode) {
    try {
      var s = "";
      s += getIntAttr("number", number, 1, 4);
      s += getIntAttr("x", x, 1, 44);
      s += getIntAttr("y", y, 1, 19);
      s += getIntAttr("width", width, 1, 44);
      s += getIntAttr("height", hight, 1, 19);
      s += getEnumAttr("scrollmode", scrollMode, regexScrollMode);
      this.message += "<window" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.destroyWindow = function(number) {
    try {
      var s = "";
      s += getIntAttr("number", number, 1, 4);
      this.message += "<window" + s + ' destroy="true"/>'
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.setCurrentWindow = function(number) {
    try {
      var s = "";
      s += getIntAttr("number", number, 1, 4);
      this.message += "<window" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.setCursorPosition = function() {
    try {
      var s = "";
      s += getIntAttr("x", arguments[0], 1, 44);
      s += getIntAttr("y", arguments[1], 1, 19);
      this.message += "<cursor" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.moveCursorPosition = function() {
    try {
      var s = "";
      s += getEnumAttr("moveto", arguments[0], regexMoveto);
      this.message += "<cursor" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.setCursorType = function(underline) {
    try {
      var s = "";
      s += getEnumAttr("type", underline, regexUnderline);
      this.message += "<cursor" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addText = function() {
    try {
      var s = "";
      switch (arguments.length) {
        case 1:
          break;
        case 2:
          if (arguments[1] != undefined) {
            s += ' lang="' + arguments[1] + '"'
          }
          break;
        case 3:
          if ((arguments[1] != undefined) && (arguments[2] != undefined)) {
            s += getIntAttr("x", arguments[1], 1, 44);
            s += getIntAttr("y", arguments[2], 1, 19)
          }
          break;
        case 4:
          if ((arguments[1] != undefined) && (arguments[2] != undefined)) {
            s += getIntAttr("x", arguments[1], 1, 44);
            s += getIntAttr("y", arguments[2], 1, 19)
          }
          if (arguments[3] != undefined) {
            s += ' lang="' + arguments[3] + '"'
          }
          break;
        case 7:
          if ((arguments[1] != undefined) && (arguments[2] != undefined)) {
            s += getIntAttr("x", arguments[1], 1, 44);
            s += getIntAttr("y", arguments[2], 1, 19)
          }
          if (arguments[3] != undefined) {
            s += ' lang="' + arguments[3] + '"'
          }
          if ((arguments[4] != undefined) && (arguments[5] != undefined) && (arguments[6] != undefined)) {
            var tmp = getIntAttr("r", arguments[4], 0, 255);
            tmp = getIntAttr("g", arguments[5], 0, 255);
            tmp = getIntAttr("b", arguments[6], 0, 255);
            var rHex = ("00" + Number(arguments[4]).toString(16)).slice(-2);
            var gHex = ("00" + Number(arguments[5]).toString(16)).slice(-2);
            var bHex = ("00" + Number(arguments[6]).toString(16)).slice(-2);
            var color = "#" + rHex + gHex + bHex;
            s += ' color="' + color + '"'
          }
          break;
        default:
          throw new Error("Parameters are invalid");
          break
      }
      this.message += "<text" + s + ">" + escapeMarkup(arguments[0]) + "</text>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addReverseText = function() {
    try {
      var s = "";
      switch (arguments.length) {
        case 1:
          s += getBoolAttr("reverse", true);
          break;
        case 2:
          s += ' lang="' + arguments[1] + '"';
          s += getBoolAttr("reverse", true);
          break;
        case 3:
          s += getIntAttr("x", arguments[1], 1, 20);
          s += getIntAttr("y", arguments[2], 1, 2);
          s += getBoolAttr("reverse", true);
          break;
        case 4:
          s += getIntAttr("x", arguments[1], 1, 20);
          s += getIntAttr("y", arguments[2], 1, 2);
          s += ' lang="' + arguments[3] + '"';
          s += getBoolAttr("reverse", true);
          break;
        default:
          throw new Error("Parameters are invalid");
          break
      }
      this.message += "<text" + s + ">" + escapeMarkup(arguments[0]) + "</text>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.clearWindow = function() {
    try {
      this.message += "<clear/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.setBlink = function(interval) {
    try {
      var s = "";
      s += getUShortAttr("interval", interval);
      this.message += "<blink" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.setBrightness = function(value) {
    try {
      var s = "";
      s += getEnumAttr("value", value, regexBrightness);
      this.message += "<brightness" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addMarquee = function(text, format, uwait, rwait, repeat, lang) {
    try {
      var s = "";
      s += getEnumAttr("format", format, regexMarquee);
      s += getIntAttr("uwait", uwait, 0, 2000);
      s += getIntAttr("rwait", rwait, 100, 2000);
      s += getIntAttr("repeat", repeat, 0, 127);
      if ((typeof lang) !== "undefined") {
        s += ' lang="' + lang + '"'
      }
      this.message += "<marquee" + s + ">" + escapeMarkup(text) + "</marquee>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.showClock = function() {
    try {
      this.message += "<clock/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addCommand = function(text) {
    try {
      this.message += "<command>" + toHexBinary(text) + "</command>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addCreateScreen = function(mode) {
    try {
      var s = "";
      s += getIntAttr("mode", mode, 1, 15);
      this.message += "<screen" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addCreateScreenCustom = function(mode, column, row) {
    try {
      var s = "";
      s += getIntAttr("mode", mode, 20, 31);
      s += getIntAttr("column", column, 1, 44);
      s += getIntAttr("row", row, 1, 19);
      this.message += "<screen" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addBackgroundColor = function(row, r, g, b) {
    try {
      var s = "";
      s += getEnumAttr("row", row, regexRow);
      var tmp = getIntAttr("r", r, 0, 255);
      tmp = getIntAttr("g", g, 0, 255);
      tmp = getIntAttr("b", b, 0, 255);
      var rHex = ("00" + Number(r).toString(16)).slice(-2);
      var gHex = ("00" + Number(g).toString(16)).slice(-2);
      var bHex = ("00" + Number(b).toString(16)).slice(-2);
      var color = "#" + rHex + gHex + bHex;
      s += ' color="' + color + '"';
      this.message += "<backgroundcolor" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addStartSlideShow = function(interval) {
    try {
      var s = "";
      s += getIntAttr("interval", interval, 200, 51000);
      this.message += "<slideshow" + s + ' stop="false"/>'
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addStopSlideShow = function() {
    try {
      this.message += '<slideshow stop="true"/>'
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addSymbol = function(data, type, level, width, height, dotX, dotY, quietZone) {
    try {
      var s = "";
      s += getEnumAttr("type", type, regexSymbol);
      s += getEnumAttr("level", level, regexLevel);
      s += getIntAttr("width", width, 1, 255);
      s += getIntAttr("dotx", dotX, 0, 799);
      s += getIntAttr("doty", dotY, 0, 799);
      s += getEnumAttr("quietzone", quietZone, regexQuietZone);
      this.message += "<symbol" + s + ">" + escapeControl(escapeMarkup(data)) + "</symbol>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addDownloadImage = function(key1, key2, dotX, dotY, width, height) {
    try {
      var s = "";
      s += getIntAttr("key1", key1, 0, 255);
      s += getIntAttr("key2", key2, 0, 255);
      s += getIntAttr("dotx", dotX, 0, 799);
      s += getIntAttr("doty", dotY, 0, 799);
      s += getIntAttr("width", width, 0, 1440);
      s += getIntAttr("height", height, 0, 1440);
      this.message += "<downloadimage" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addRegisterDownloadImage = function(data, key1, key2) {
    try {
      var s = "";
      s += getIntAttr("key1", key1, 0, 255);
      s += getIntAttr("key2", key2, 0, 255);
      this.message += "<registerdownloadimage" + s + ">" + toBase64Binary(data) + "</registerdownloadimage>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addNVImage = function(key1, key2, dotX, dotY, width, height) {
    try {
      var s = "";
      s += getIntAttr("key1", key1, 0, 255);
      s += getIntAttr("key2", key2, 0, 255);
      s += getIntAttr("dotx", dotX, 0, 799);
      s += getIntAttr("doty", dotY, 0, 799);
      s += getIntAttr("width", width, 0, 1440);
      s += getIntAttr("height", height, 0, 1440);
      this.message += "<nvimage" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addClearImage = function() {
    try {
      this.message += "<clearimage/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.addClearSymbol = function() {
    try {
      this.message += "<clearsymbol/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.createTextArea = function(number, x, y, width, height, scrollMode) {
    try {
      var s = "";
      s += getIntAttr("number", number, 1, 4);
      s += getIntAttr("x", x, 1, 44);
      s += getIntAttr("y", y, 1, 19);
      s += getIntAttr("width", width, 1, 44);
      s += getIntAttr("height", height, 1, 19);
      s += getEnumAttr("scrollmode", scrollMode, regexScrollMode);
      this.message += "<textarea" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.destroyTextArea = function(number) {
    try {
      var s = "";
      s += getIntAttr("number", number, 1, 4);
      this.message += "<textarea" + s + ' destroy="true"/>'
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.setCurrentTextArea = function(number) {
    try {
      var s = "";
      s += getIntAttr("number", number, 1, 4);
      this.message += "<textarea" + s + "/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.clearTextArea = function() {
    try {
      this.message += "<clear/>"
    } catch (e) {
      throw e
    }
    return this
  };
  Display.prototype.send = function() {
    var sq = -1;
    if ((!this.ePosDev.eposprint) && (this.connectionObj.isUsableDeviceIF())) {
      try {
        var xml = this.toString();
        var data = {
          type: "display",
          timeout: this.timeout,
          displaydata: xml
        };
        var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
        this.connectionObj.emit(eposmsg);
        sq = eposmsg.sequence;
        this.message = ""
      } catch (e) {
        sq = -1
      }
    } else {
      var self = this,
        address = this.connectionObj.getAddressWithProtocol() + "/cgi-bin/eposDisp/service.cgi?devid=" + this.deviceID + "&timeout=" + this.timeout,
        soap, xhr, tid, res, success, code, status;
      res = {};
      soap = '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">';
      soap += "<s:Body>" + this.toString() + "</s:Body></s:Envelope>";
      if (window.XMLHttpRequest) {
        xhr = new XMLHttpRequest();
        if (!("withCredentials" in xhr) && window.XDomainRequest) {
          xhr = new XDomainRequest();
          xhr.open("POST", address, true);
          xhr.onload = function() {
            res = xhr.responseText;
            if (/response/.test(res)) {
              success = /success\s*=\s*"\s*(1|true)\s*"/.test(res);
              code = res.match(/code\s*=\s*"\s*(\S*)\s*"/) ? RegExp.$1 : "";
              status = res.match(/status\s*=\s*"\s*(\d+)\s*"/) ? parseInt(RegExp.$1) : 0;
              self.fireReceiveEvent(success, code, status, 0)
            } else {
              self.fireErrorEvent(0, xhr.responseText, 0)
            }
          };
          xhr.onerror = function() {
            self.fireErrorEvent(0, xhr.responseText, 0)
          };
          xhr.onprogress = function() {};
          xhr.ontimeout = xhr.onerror;
          xhr.timeout = self.timeout;
          xhr.send(soap)
        } else {
          xhr.open("POST", address, true);
          xhr.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
          xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT");
          xhr.setRequestHeader("SOAPAction", '""');
          xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
              clearTimeout(tid);
              if (xhr.status == 200 && xhr.responseXML) {
                res = xhr.responseXML.getElementsByTagName("response");
                if (res.length > 0) {
                  success = /^(1|true)$/.test(res[0].getAttribute("success"));
                  code = res[0].hasAttribute("code") ? res[0].getAttribute("code") : "";
                  status = res[0].hasAttribute("status") ? parseInt(res[0].getAttribute("status")) : 0;
                  self.fireReceiveEvent(success, code, status, 0)
                } else {
                  self.fireErrorEvent(xhr.status, xhr.responseText, 0)
                }
              } else {
                self.fireErrorEvent(xhr.status, xhr.responseText, 0)
              }
            }
          };
          tid = setTimeout(function() {
            xhr.abort()
          }, this.timeout);
          xhr.send(soap)
        }
        this.message = ""
      } else {
        throw new Error("XMLHttpRequest is not supported")
      }
      sq = 0
    }
    return sq
  };
  Display.prototype.fireReceiveEvent = function(success, code, status, sq) {
    if (code == "EX_ENPC_TIMEOUT") {
      code = "ERROR_DEVICE_BUSY"
    }
    if (this.onreceive) {
      this.onreceive({
        success: success,
        code: code,
        status: status
      }, sq)
    }
  };
  Display.prototype.fireErrorEvent = function(status, responseText, sq) {
    if (this.onerror) {
      this.onerror({
        status: 0,
        responseText: this.ASB_NO_RESPONSE
      }, sq)
    }
    this.ePosDev.cleanup()
  };
  Display.prototype.client_onxmlresult = function(res, sq) {
    if (res) {
      var xml = res.resultdata;
      var success = /success\s*=\s*"\s*(1|true)\s*"/.test(xml);
      xml.match(/code\s*=\s*"\s*(\S*)\s*"/);
      var code = RegExp.$1;
      xml.match(/status\s*=\s*"\s*(\d+)\s*"/);
      var status = parseInt(RegExp.$1);
      if (this.onreceive) {
        this.onreceive({
          success: success,
          code: code,
          status: status
        }, sq)
      }
    } else {
      if (this.onerror) {
        this.onerror({
          status: 0,
          responseText: this.ASB_NO_RESPONSE
        }, sq)
      }
      this.ePosDev.cleanup()
    }
  };
  Display.prototype.toString = function() {
    var epos = '<epos-display xmlns="http://www.epson-pos.com/schemas/2012/09/epos-display">' + this.message + "</epos-display>";
    return epos
  };
  Display.prototype.setXmlString = function(xml) {
    this.message = xml
  };
  Display.prototype.getXmlString = function() {
    return this.message
  };
  Display.prototype.callEvent = function(eventName, data) {
    var eventReq = {
      type: eventName,
      data: data
    };
    var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
    var sequence = -1;
    try {
      this.connectionObj.emit(eposmsg);
      sequence = eposmsg.sequence
    } catch (e) {}
    return sequence
  };
  var regexBrightness = /^(20|40|60|100)$/;
  var regexScrollMode = /^(overwrite|v_scroll|h_scroll)$/;
  var regexMoveto = /^(top_left|top_right|bottom_left|bottom_right)$/;
  var regexUnderline = /^(none|underline)$/;
  var regexMarquee = /^(walk|place)$/;
  var regexRow = /^([1-9]|1[0-9]|even|odd|all)$/;
  var regexSymbol = /^(qrcode_(model_[12]))$/;
  var regexLevel = /^(level_[lmqh]|default)$/;
  var regexQuietZone = /^(true|false)$/;

  function OtherPeripheral(deviceID, isCrypto) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connectionObj = null
  }
  OtherPeripheral.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    send: function(methodName, data) {
      var _data = {};
      for (var key in data) {
        _data[key] = data[key]
      }
      _data.type = methodName;
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, _data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    },
    client_onreceive: function(data) {
      try {
        var eventData = data;
        delete eventData.type;
        this.onreceive(data.type, eventData)
      } catch (e) {}
      return
    },
    callEvent: function(eventName, data) {
      var eventReq = {
        type: eventName,
        data: data
      };
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    }
  };

  function Keyboard(deviceID, isCrypto) {
    this.VK_CANCEL = 3;
    this.VK_BACK = 8;
    this.VK_TAB = 9;
    this.VK_RETURN = 13;
    this.VK_SHIFT = 16;
    this.VK_CONTROL = 17;
    this.VK_MENU = 18;
    this.VK_PAUSE = 19;
    this.VK_CAPITAL = 20;
    this.VK_KANA = 21;
    this.VK_ESCAPE = 27;
    this.VK_CONVERT = 28;
    this.VK_NONCONVERT = 29;
    this.VK_SPACE = 32;
    this.VK_PRIOR = 33;
    this.VK_NEXT = 34;
    this.VK_END = 35;
    this.VK_HOME = 36;
    this.VK_LEFT = 37;
    this.VK_UP = 38;
    this.VK_RIGHT = 39;
    this.VK_DOWN = 40;
    this.VK_INSERT = 45;
    this.VK_DELETE = 46;
    this.VK_0 = 48;
    this.VK_1 = 49;
    this.VK_2 = 50;
    this.VK_3 = 51;
    this.VK_4 = 52;
    this.VK_5 = 53;
    this.VK_6 = 54;
    this.VK_7 = 55;
    this.VK_8 = 56;
    this.VK_9 = 57;
    this.VK_A = 65;
    this.VK_B = 66;
    this.VK_C = 67;
    this.VK_D = 68;
    this.VK_E = 69;
    this.VK_F = 70;
    this.VK_G = 71;
    this.VK_H = 72;
    this.VK_I = 73;
    this.VK_J = 74;
    this.VK_K = 75;
    this.VK_L = 76;
    this.VK_M = 77;
    this.VK_N = 78;
    this.VK_O = 79;
    this.VK_P = 80;
    this.VK_Q = 81;
    this.VK_R = 82;
    this.VK_S = 83;
    this.VK_T = 84;
    this.VK_U = 85;
    this.VK_V = 86;
    this.VK_W = 87;
    this.VK_X = 88;
    this.VK_Y = 89;
    this.VK_Z = 90;
    this.VK_LWIN = 91;
    this.VK_RWIN = 92;
    this.VK_APPS = 93;
    this.VK_NUMPAD0 = 96;
    this.VK_NUMPAD1 = 97;
    this.VK_NUMPAD2 = 98;
    this.VK_NUMPAD3 = 99;
    this.VK_NUMPAD4 = 100;
    this.VK_NUMPAD5 = 101;
    this.VK_NUMPAD6 = 102;
    this.VK_NUMPAD7 = 103;
    this.VK_NUMPAD8 = 104;
    this.VK_NUMPAD9 = 105;
    this.VK_MULTIPLY = 106;
    this.VK_ADD = 107;
    this.VK_SEPARATOR = 108;
    this.VK_SUBTRACT = 109;
    this.VK_DECIMAL = 110;
    this.VK_DIVIDE = 111;
    this.VK_F1 = 112;
    this.VK_F2 = 113;
    this.VK_F3 = 114;
    this.VK_F4 = 115;
    this.VK_F5 = 116;
    this.VK_F6 = 117;
    this.VK_F7 = 118;
    this.VK_F8 = 119;
    this.VK_F9 = 120;
    this.VK_F10 = 121;
    this.VK_F11 = 122;
    this.VK_F12 = 123;
    this.VK_NUMLOCK = 144;
    this.VK_SCROLL = 145;
    this.VK_LSHIFT = 160;
    this.VK_RSHIFT = 161;
    this.VK_LCONTROL = 162;
    this.VK_RCONTROL = 163;
    this.VK_LMENU = 164;
    this.VK_RMENU = 165;
    this.VK_OEM_1 = 186;
    this.VK_OEM_PLUS = 187;
    this.VK_OEM_COMMA = 188;
    this.VK_OEM_MINUS = 189;
    this.VK_OEM_PERIOD = 190;
    this.VK_OEM_2 = 191;
    this.VK_OEM_3 = 192;
    this.VK_OEM_4 = 219;
    this.VK_OEM_5 = 220;
    this.VK_OEM_6 = 221;
    this.VK_OEM_7 = 222;
    this.VK_OEM_102 = 226;
    this.VK_OEM_ATTN = 240;
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connectionObj = null
  }
  Keyboard.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    client_onkeypress: function(data) {
      try {
        if (this.onkeypress == null) {
          return
        }
        this.onkeypress(data)
      } catch (e) {}
      return
    },
    client_onstring: function(data) {
      try {
        if (this.onstring == null) {
          return
        }
        this.onstring(data)
      } catch (e) {}
      return
    },
    setPrefix: function(keycodes) {
      var data = {
        type: "setprefix"
      };
      if (typeof keycodes == "object") {
        if ((keycodes.length == 0)) {
          return -1
        }
        data.keycodes = keycodes
      } else {
        if ((keycodes == null) || (keycodes == "")) {
          return -1
        }
        data.keycodes = [keycodes]
      }
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    },
    callEvent: function(eventName, data) {
      var eventReq = data;
      eventReq.type = eventName;
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, eventReq, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    }
  };

  function MSR(deviceID, isCrypto) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connectionObj = null
  }
  MSR.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    client_ondata: function(data) {
      try {
        if (this.ondata == null) {
          return
        }
        this.ondata(data)
      } catch (e) {}
      return
    },
    callEvent: function(eventName, data) {
      var eventReq = data;
      eventReq.type = eventName;
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, eventReq, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    }
  };
  /*! Based JavaScript is ePOS-Print API Version 5.0.0 */
  function ePOSBuilder() {
    this.message = "";
    this.halftone = 0;
    this.brightness = 1;
    this.force = false;
    this.FONT_A = "font_a";
    this.FONT_B = "font_b";
    this.FONT_C = "font_c";
    this.FONT_D = "font_d";
    this.FONT_E = "font_e";
    this.FONT_SPECIAL_A = "special_a";
    this.FONT_SPECIAL_B = "special_b";
    this.ALIGN_LEFT = "left";
    this.ALIGN_CENTER = "center";
    this.ALIGN_RIGHT = "right";
    this.COLOR_NONE = "none";
    this.COLOR_1 = "color_1";
    this.COLOR_2 = "color_2";
    this.COLOR_3 = "color_3";
    this.COLOR_4 = "color_4";
    this.FEED_PEELING = "peeling";
    this.FEED_CUTTING = "cutting";
    this.FEED_CURRENT_TOF = "current_tof";
    this.FEED_NEXT_TOF = "next_tof";
    this.MODE_MONO = "mono";
    this.MODE_GRAY16 = "gray16";
    this.BARCODE_UPC_A = "upc_a";
    this.BARCODE_UPC_E = "upc_e";
    this.BARCODE_EAN13 = "ean13";
    this.BARCODE_JAN13 = "jan13";
    this.BARCODE_EAN8 = "ean8";
    this.BARCODE_JAN8 = "jan8";
    this.BARCODE_CODE39 = "code39";
    this.BARCODE_ITF = "itf";
    this.BARCODE_CODABAR = "codabar";
    this.BARCODE_CODE93 = "code93";
    this.BARCODE_CODE128 = "code128";
    this.BARCODE_GS1_128 = "gs1_128";
    this.BARCODE_GS1_DATABAR_OMNIDIRECTIONAL = "gs1_databar_omnidirectional";
    this.BARCODE_GS1_DATABAR_TRUNCATED = "gs1_databar_truncated";
    this.BARCODE_GS1_DATABAR_LIMITED = "gs1_databar_limited";
    this.BARCODE_GS1_DATABAR_EXPANDED = "gs1_databar_expanded";
    this.BARCODE_CODE128_AUTO = "code128_auto";
    this.HRI_NONE = "none";
    this.HRI_ABOVE = "above";
    this.HRI_BELOW = "below";
    this.HRI_BOTH = "both";
    this.SYMBOL_PDF417_STANDARD = "pdf417_standard";
    this.SYMBOL_PDF417_TRUNCATED = "pdf417_truncated";
    this.SYMBOL_QRCODE_MODEL_1 = "qrcode_model_1";
    this.SYMBOL_QRCODE_MODEL_2 = "qrcode_model_2";
    this.SYMBOL_QRCODE_MICRO = "qrcode_micro";
    this.SYMBOL_MAXICODE_MODE_2 = "maxicode_mode_2";
    this.SYMBOL_MAXICODE_MODE_3 = "maxicode_mode_3";
    this.SYMBOL_MAXICODE_MODE_4 = "maxicode_mode_4";
    this.SYMBOL_MAXICODE_MODE_5 = "maxicode_mode_5";
    this.SYMBOL_MAXICODE_MODE_6 = "maxicode_mode_6";
    this.SYMBOL_GS1_DATABAR_STACKED = "gs1_databar_stacked";
    this.SYMBOL_GS1_DATABAR_STACKED_OMNIDIRECTIONAL = "gs1_databar_stacked_omnidirectional";
    this.SYMBOL_GS1_DATABAR_EXPANDED_STACKED = "gs1_databar_expanded_stacked";
    this.SYMBOL_AZTECCODE_FULLRANGE = "azteccode_fullrange";
    this.SYMBOL_AZTECCODE_COMPACT = "azteccode_compact";
    this.SYMBOL_DATAMATRIX_SQUARE = "datamatrix_square";
    this.SYMBOL_DATAMATRIX_RECTANGLE_8 = "datamatrix_rectangle_8";
    this.SYMBOL_DATAMATRIX_RECTANGLE_12 = "datamatrix_rectangle_12";
    this.SYMBOL_DATAMATRIX_RECTANGLE_16 = "datamatrix_rectangle_16";
    this.LEVEL_0 = "level_0";
    this.LEVEL_1 = "level_1";
    this.LEVEL_2 = "level_2";
    this.LEVEL_3 = "level_3";
    this.LEVEL_4 = "level_4";
    this.LEVEL_5 = "level_5";
    this.LEVEL_6 = "level_6";
    this.LEVEL_7 = "level_7";
    this.LEVEL_8 = "level_8";
    this.LEVEL_L = "level_l";
    this.LEVEL_M = "level_m";
    this.LEVEL_Q = "level_q";
    this.LEVEL_H = "level_h";
    this.LEVEL_DEFAULT = "default";
    this.LINE_THIN = "thin";
    this.LINE_MEDIUM = "medium";
    this.LINE_THICK = "thick";
    this.LINE_THIN_DOUBLE = "thin_double";
    this.LINE_MEDIUM_DOUBLE = "medium_double";
    this.LINE_THICK_DOUBLE = "thick_double";
    this.DIRECTION_LEFT_TO_RIGHT = "left_to_right";
    this.DIRECTION_BOTTOM_TO_TOP = "bottom_to_top";
    this.DIRECTION_RIGHT_TO_LEFT = "right_to_left";
    this.DIRECTION_TOP_TO_BOTTOM = "top_to_bottom";
    this.CUT_NO_FEED = "no_feed";
    this.CUT_FEED = "feed";
    this.CUT_RESERVE = "reserve";
    this.FULL_CUT_NO_FEED = "no_feed_fullcut";
    this.FULL_CUT_FEED = "feed_fullcut";
    this.FULL_CUT_RESERVE = "reserve_fullcut";
    this.DRAWER_1 = "drawer_1";
    this.DRAWER_2 = "drawer_2";
    this.PULSE_100 = "pulse_100";
    this.PULSE_200 = "pulse_200";
    this.PULSE_300 = "pulse_300";
    this.PULSE_400 = "pulse_400";
    this.PULSE_500 = "pulse_500";
    this.PATTERN_NONE = "none";
    this.PATTERN_0 = "pattern_0";
    this.PATTERN_1 = "pattern_1";
    this.PATTERN_2 = "pattern_2";
    this.PATTERN_3 = "pattern_3";
    this.PATTERN_4 = "pattern_4";
    this.PATTERN_5 = "pattern_5";
    this.PATTERN_6 = "pattern_6";
    this.PATTERN_7 = "pattern_7";
    this.PATTERN_8 = "pattern_8";
    this.PATTERN_9 = "pattern_9";
    this.PATTERN_10 = "pattern_10";
    this.PATTERN_A = "pattern_a";
    this.PATTERN_B = "pattern_b";
    this.PATTERN_C = "pattern_c";
    this.PATTERN_D = "pattern_d";
    this.PATTERN_E = "pattern_e";
    this.PATTERN_ERROR = "error";
    this.PATTERN_PAPER_END = "paper_end";
    this.LAYOUT_RECEIPT = "receipt";
    this.LAYOUT_RECEIPT_BM = "receipt_bm";
    this.LAYOUT_LABEL = "label";
    this.LAYOUT_LABEL_BM = "label_bm";
    this.HALFTONE_DITHER = 0;
    this.HALFTONE_ERROR_DIFFUSION = 1;
    this.HALFTONE_THRESHOLD = 2
  }
  ePOSBuilder.prototype.addText = function(data) {
    this.message += "<text>" + escapeMarkup(data) + "</text>";
    return this
  };
  ePOSBuilder.prototype.addTextLang = function(lang) {
    this.message += '<text lang="' + lang + '"/>';
    return this
  };
  ePOSBuilder.prototype.addTextAlign = function(align) {
    var s = "";
    s += getEnumAttr("align", align, regexAlign);
    this.message += "<text" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addTextRotate = function(rotate) {
    var s = "";
    s += getBoolAttr("rotate", rotate);
    this.message += "<text" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addTextLineSpace = function(linespc) {
    var s = "";
    s += getUByteAttr("linespc", linespc);
    this.message += "<text" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addTextFont = function(font) {
    var s = "";
    s += getEnumAttr("font", font, regexFont);
    this.message += "<text" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addTextSmooth = function(smooth) {
    var s = "";
    s += getBoolAttr("smooth", smooth);
    this.message += "<text" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addTextDouble = function(dw, dh) {
    var s = "";
    if (dw !== undefined) {
      s += getBoolAttr("dw", dw)
    }
    if (dh !== undefined) {
      s += getBoolAttr("dh", dh)
    }
    this.message += "<text" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addTextSize = function(width, height) {
    var s = "";
    if (width !== undefined) {
      s += getIntAttr("width", width, 1, 8)
    }
    if (height !== undefined) {
      s += getIntAttr("height", height, 1, 8)
    }
    this.message += "<text" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addTextStyle = function(reverse, ul, em, color) {
    var s = "";
    if (reverse !== undefined) {
      s += getBoolAttr("reverse", reverse)
    }
    if (ul !== undefined) {
      s += getBoolAttr("ul", ul)
    }
    if (em !== undefined) {
      s += getBoolAttr("em", em)
    }
    if (color !== undefined) {
      s += getEnumAttr("color", color, regexColor)
    }
    this.message += "<text" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addTextPosition = function(x) {
    var s = "";
    s += getUShortAttr("x", x);
    this.message += "<text" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addTextVPosition = function(y) {
    var s = "";
    s += getUShortAttr("y", y);
    this.message += "<text" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addFeedUnit = function(unit) {
    var s = "";
    s += getUByteAttr("unit", unit);
    this.message += "<feed" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addFeedLine = function(line) {
    var s = "";
    s += getUByteAttr("line", line);
    this.message += "<feed" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addFeed = function() {
    this.message += "<feed/>";
    return this
  };
  ePOSBuilder.prototype.addFeedPosition = function(pos) {
    var s = "";
    s += getEnumAttr("pos", pos, regexFeed);
    this.message += "<feed" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addImage = function(context, x, y, width, height, color, mode) {
    var s = "",
      ht = this.halftone,
      br = this.brightness,
      imgdata, raster;
    getUShortAttr("x", x);
    getUShortAttr("y", y);
    s += getUShortAttr("width", width);
    s += getUShortAttr("height", height);
    if (color !== undefined) {
      s += getEnumAttr("color", color, regexColor)
    }
    if (mode !== undefined) {
      s += getEnumAttr("mode", mode, regexMode)
    }
    if (isNaN(ht) || ht < 0 || ht > 2) {
      throw new Error('Property "halftone" is invalid')
    }
    if (isNaN(br) || br < 0.1 || br > 10) {
      throw new Error('Property "brightness" is invalid')
    }
    imgdata = context.getImageData(x, y, width, height);
    raster = (mode == this.MODE_GRAY16) ? toGrayImage(imgdata, br) : toMonoImage(imgdata, ht, br);
    this.message += "<image" + s + ">" + toBase64Binary(raster) + "</image>";
    return this
  };
  ePOSBuilder.prototype.addLogo = function(key1, key2) {
    var s = "";
    s += getUByteAttr("key1", key1);
    s += getUByteAttr("key2", key2);
    this.message += "<logo" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addBarcode = function(data, type, hri, font, width, height) {
    var s = "";
    s += getEnumAttr("type", type, regexBarcode);
    if (hri !== undefined) {
      s += getEnumAttr("hri", hri, regexHri)
    }
    if (font !== undefined) {
      s += getEnumAttr("font", font, regexFont)
    }
    if (width !== undefined) {
      s += getUByteAttr("width", width)
    }
    if (height !== undefined) {
      s += getUByteAttr("height", height)
    }
    this.message += "<barcode" + s + ">" + escapeControl(escapeMarkup(data)) + "</barcode>";
    return this
  };
  ePOSBuilder.prototype.addSymbol = function(data, type, level, width, height, size) {
    var s = "";
    s += getEnumAttr("type", type, regexSymbol);
    if (level !== undefined) {
      s += getEnumIntAttr("level", level, regexLevel, 0, 255)
    }
    if (width !== undefined) {
      s += getUByteAttr("width", width)
    }
    if (height !== undefined) {
      s += getUByteAttr("height", height)
    }
    if (size !== undefined) {
      s += getUShortAttr("size", size)
    }
    this.message += "<symbol" + s + ">" + escapeControl(escapeMarkup(data)) + "</symbol>";
    return this
  };
  ePOSBuilder.prototype.addHLine = function(x1, x2, style) {
    var s = "";
    s += getUShortAttr("x1", x1);
    s += getUShortAttr("x2", x2);
    if (style !== undefined) {
      s += getEnumAttr("style", style, regexLine)
    }
    this.message += "<hline" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addVLineBegin = function(x, style) {
    var s = "";
    s += getUShortAttr("x", x);
    if (style !== undefined) {
      s += getEnumAttr("style", style, regexLine)
    }
    this.message += "<vline-begin" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addVLineEnd = function(x, style) {
    var s = "";
    s += getUShortAttr("x", x);
    if (style !== undefined) {
      s += getEnumAttr("style", style, regexLine)
    }
    this.message += "<vline-end" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addPageBegin = function() {
    this.message += "<page>";
    return this
  };
  ePOSBuilder.prototype.addPageEnd = function() {
    this.message += "</page>";
    return this
  };
  ePOSBuilder.prototype.addPageArea = function(x, y, width, height) {
    var s = "";
    s += getUShortAttr("x", x);
    s += getUShortAttr("y", y);
    s += getUShortAttr("width", width);
    s += getUShortAttr("height", height);
    this.message += "<area" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addPageDirection = function(dir) {
    var s = "";
    s += getEnumAttr("dir", dir, regexDirection);
    this.message += "<direction" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addPagePosition = function(x, y) {
    var s = "";
    s += getUShortAttr("x", x);
    s += getUShortAttr("y", y);
    this.message += "<position" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addPageLine = function(x1, y1, x2, y2, style) {
    var s = "";
    s += getUShortAttr("x1", x1);
    s += getUShortAttr("y1", y1);
    s += getUShortAttr("x2", x2);
    s += getUShortAttr("y2", y2);
    if (style !== undefined) {
      s += getEnumAttr("style", style, regexLine)
    }
    this.message += "<line" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addPageRectangle = function(x1, y1, x2, y2, style) {
    var s = "";
    s += getUShortAttr("x1", x1);
    s += getUShortAttr("y1", y1);
    s += getUShortAttr("x2", x2);
    s += getUShortAttr("y2", y2);
    if (style !== undefined) {
      s += getEnumAttr("style", style, regexLine)
    }
    this.message += "<rectangle" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addRotateBegin = function() {
    this.message += "<rotate-begin/>";
    return this
  };
  ePOSBuilder.prototype.addRotateEnd = function() {
    this.message += "<rotate-end/>";
    return this
  };
  ePOSBuilder.prototype.addCut = function(type) {
    var s = "";
    if (type !== undefined) {
      s += getEnumAttr("type", type, regexCut)
    }
    this.message += "<cut" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addPulse = function(drawer, time) {
    var s = "";
    if (drawer !== undefined) {
      s += getEnumAttr("drawer", drawer, regexDrawer)
    }
    if (time !== undefined) {
      s += getEnumAttr("time", time, regexPulse)
    }
    this.message += "<pulse" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addSound = function(pattern, repeat, cycle) {
    var s = "";
    if (pattern !== undefined) {
      s += getEnumAttr("pattern", pattern, regexPattern)
    }
    if (repeat !== undefined) {
      s += getUByteAttr("repeat", repeat)
    }
    if (cycle !== undefined) {
      s += getUShortAttr("cycle", cycle)
    }
    this.message += "<sound" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addLayout = function(type, width, height, margin_top, margin_bottom, offset_cut, offset_label) {
    var s = "";
    s += getEnumAttr("type", type, regexLayout);
    if (width !== undefined) {
      s += getUShortAttr("width", width)
    }
    if (height !== undefined) {
      s += getUShortAttr("height", height)
    }
    if (margin_top !== undefined) {
      s += getShortAttr("margin-top", margin_top)
    }
    if (margin_bottom !== undefined) {
      s += getShortAttr("margin-bottom", margin_bottom)
    }
    if (offset_cut !== undefined) {
      s += getShortAttr("offset-cut", offset_cut)
    }
    if (offset_label !== undefined) {
      s += getShortAttr("offset-label", offset_label)
    }
    this.message += "<layout" + s + "/>";
    return this
  };
  ePOSBuilder.prototype.addRecovery = function() {
    this.message += "<recovery/>";
    return this
  };
  ePOSBuilder.prototype.addReset = function() {
    this.message += "<reset/>";
    return this
  };
  ePOSBuilder.prototype.addCommand = function(data) {
    this.message += "<command>" + toHexBinary(data) + "</command>";
    return this
  };
  ePOSBuilder.prototype.toString = function() {
    var s = "";
    if (this.force) {
      s += getBoolAttr("force", true)
    }
    return '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"' + s + ">" + this.message + "</epos-print>"
  };

  function toHexBinary(s) {
    var l = s.length,
      r = new Array(l),
      i;
    for (i = 0; i < l; i++) {
      r[i] = ("0" + s.charCodeAt(i).toString(16)).slice(-2)
    }
    return r.join("")
  }

  function toBase64Binary(s) {
    var l = s.length,
      r = new Array((l + 2) / 3 << 2),
      t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
      p = (3 - l % 3) % 3,
      j = 0,
      i = 0,
      n;
    s += "\x00\x00";
    while (i < l) {
      n = s.charCodeAt(i++) << 16 | s.charCodeAt(i++) << 8 | s.charCodeAt(i++);
      r[j++] = t.charAt(n >> 18 & 63);
      r[j++] = t.charAt(n >> 12 & 63);
      r[j++] = t.charAt(n >> 6 & 63);
      r[j++] = t.charAt(n & 63)
    }
    while (p--) {
      r[--j] = "="
    }
    return r.join("")
  }

  function toMonoImage(imgdata, s, g) {
    var x = String.fromCharCode,
      m8 = [
        [2, 130, 34, 162, 10, 138, 42, 170],
        [194, 66, 226, 98, 202, 74, 234, 106],
        [50, 178, 18, 146, 58, 186, 26, 154],
        [242, 114, 210, 82, 250, 122, 218, 90],
        [14, 142, 46, 174, 6, 134, 38, 166],
        [206, 78, 238, 110, 198, 70, 230, 102],
        [62, 190, 30, 158, 54, 182, 22, 150],
        [254, 126, 222, 94, 246, 118, 214, 86]
      ],
      d = imgdata.data,
      w = imgdata.width,
      h = imgdata.height,
      r = new Array((w + 7 >> 3) * h),
      n = 0,
      p = 0,
      q = 0,
      t = 128,
      e = new Array(),
      e1, e2, b, v, f, i, j;
    if (s == 1) {
      i = w;
      while (i--) {
        e.push(0)
      }
    }
    for (j = 0; j < h; j++) {
      e1 = 0;
      e2 = 0;
      i = 0;
      while (i < w) {
        b = i & 7;
        if (s == 0) {
          t = m8[j & 7][b]
        }
        v = Math.pow(((d[p++] * 0.29891 + d[p++] * 0.58661 + d[p++] * 0.11448) * d[p] / 255 + 255 - d[p++]) / 255, 1 / g) * 255 | 0;
        if (s == 1) {
          v += e[i] + e1 >> 4;
          f = v - (v < t ? 0 : 255);
          if (i > 0) {
            e[i - 1] += f
          }
          e[i] = f * 7 + e2;
          e1 = f * 5;
          e2 = f * 3
        }
        if (v < t) {
          n |= 128 >> b
        }
        i++;
        if (b == 7 || i == w) {
          r[q++] = x(n == 16 ? 32 : n);
          n = 0
        }
      }
    }
    return r.join("")
  }

  function toGrayImage(imgdata, g) {
    var x = String.fromCharCode,
      m4 = [
        [0, 9, 2, 11],
        [13, 4, 15, 6],
        [3, 12, 1, 10],
        [16, 7, 14, 5]
      ],
      thermal = [0, 7, 13, 19, 23, 27, 31, 35, 40, 44, 49, 52, 54, 55, 57, 59, 61, 62, 64, 66, 67, 69, 70, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 83, 84, 85, 86, 86, 87, 88, 88, 89, 90, 90, 91, 91, 92, 93, 93, 94, 94, 95, 96, 96, 97, 98, 98, 99, 99, 100, 101, 101, 102, 102, 103, 103, 104, 104, 105, 105, 106, 106, 107, 107, 108, 108, 109, 109, 110, 110, 111, 111, 112, 112, 112, 113, 113, 114, 114, 115, 115, 116, 116, 117, 117, 118, 118, 119, 119, 120, 120, 120, 121, 121, 122, 122, 123, 123, 123, 124, 124, 125, 125, 125, 126, 126, 127, 127, 127, 128, 128, 129, 129, 130, 130, 130, 131, 131, 132, 132, 132, 133, 133, 134, 134, 135, 135, 135, 136, 136, 137, 137, 137, 138, 138, 139, 139, 139, 140, 140, 141, 141, 141, 142, 142, 143, 143, 143, 144, 144, 145, 145, 146, 146, 146, 147, 147, 148, 148, 148, 149, 149, 150, 150, 150, 151, 151, 152, 152, 152, 153, 153, 154, 154, 155, 155, 155, 156, 156, 157, 157, 158, 158, 159, 159, 160, 160, 161, 161, 161, 162, 162, 163, 163, 164, 164, 165, 165, 166, 166, 166, 167, 167, 168, 168, 169, 169, 170, 170, 171, 171, 172, 173, 173, 174, 175, 175, 176, 177, 178, 178, 179, 180, 180, 181, 182, 182, 183, 184, 184, 185, 186, 186, 187, 189, 191, 193, 195, 198, 200, 202, 255],
      d = imgdata.data,
      w = imgdata.width,
      h = imgdata.height,
      r = new Array((w + 1 >> 1) * h),
      n = 0,
      p = 0,
      q = 0,
      b, v, v1, i, j;
    for (j = 0; j < h; j++) {
      i = 0;
      while (i < w) {
        b = i & 1;
        v = thermal[Math.pow(((d[p++] * 0.29891 + d[p++] * 0.58661 + d[p++] * 0.11448) * d[p] / 255 + 255 - d[p++]) / 255, 1 / g) * 255 | 0];
        v1 = v / 17 | 0;
        if (m4[j & 3][i & 3] < v % 17) {
          v1++
        }
        n |= v1 << ((1 - b) << 2);
        i++;
        if (b == 1 || i == w) {
          r[q++] = x(n);
          n = 0
        }
      }
    }
    return r.join("")
  }

  function escapeMarkup(s) {
    var markup = /[<>&'"\t\n\r]/g;
    if (markup.test(s)) {
      s = s.replace(markup, function(c) {
        var r = "";
        switch (c) {
          case "<":
            r = "&lt;";
            break;
          case ">":
            r = "&gt;";
            break;
          case "&":
            r = "&amp;";
            break;
          case "'":
            r = "&apos;";
            break;
          case '"':
            r = "&quot;";
            break;
          case "\t":
            r = "&#9;";
            break;
          case "\n":
            r = "&#10;";
            break;
          case "\r":
            r = "&#13;";
            break;
          default:
            break
        }
        return r
      })
    }
    return s
  }

  function escapeControl(s) {
    var control = /[\\\x00-\x1f\x7f-\xff]/g;
    if (control.test(s)) {
      s = s.replace(control, function(c) {
        return (c == "\\") ? "\\\\" : "\\x" + ("0" + c.charCodeAt(0).toString(16)).slice(-2)
      })
    }
    return s
  }
  var regexFont = /^(font_[a-e]|special_[ab])$/,
    regexAlign = /^(left|center|right)$/,
    regexColor = /^(none|color_[1-4])$/,
    regexFeed = /^(peeling|cutting|current_tof|next_tof)$/,
    regexMode = /^(mono|gray16)$/,
    regexBarcode = /^(upc_[ae]|[ej]an13|[ej]an8|code(39|93|128|128_auto)|itf|codabar|gs1_128|gs1_databar_(omnidirectional|truncated|limited|expanded))$/,
    regexHri = /^(none|above|below|both)$/,
    regexSymbol = /^(pdf417_(standard|truncated)|qrcode_(model_[12]|micro)|maxicode_mode_[2-6]|gs1_databar_(stacked(_omnidirectional)?|expanded_stacked)|azteccode_(fullrange|compact)|datamatrix_(square|rectangle_(8|12|16)))$/,
    regexLevel = /^(level_[0-8lmqh]|default)$/,
    regexLine = /^(thin|medium|thick)(_double)?$/,
    regexDirection = /^(left_to_right|bottom_to_top|right_to_left|top_to_bottom)$/,
    regexCut = /^(no_feed|feed|reserve|no_feed_fullcut|feed_fullcut|reserve_fullcut)$/,
    regexDrawer = /^drawer_[12]$/,
    regexPulse = /^pulse_[1-5]00$/,
    regexPattern = /^(none|pattern_(10|[0-9a-e])|error|paper_end)$/,
    regexLayout = /^(receipt|label)(_bm)?$/;

  function getEnumAttr(name, value, regex) {
    if (!regex.test(value)) {
      throw new Error('Parameter "' + name + '" is invalid')
    }
    return " " + name + '="' + value + '"'
  }

  function getBoolAttr(name, value) {
    return " " + name + '="' + !!value + '"'
  }

  function getIntAttr(name, value, min, max) {
    if (isNaN(value) || value < min || value > max) {
      throw new Error('Parameter "' + name + '" is invalid')
    }
    return " " + name + '="' + value + '"'
  }

  function getUByteAttr(name, value) {
    return getIntAttr(name, value, 0, 255)
  }

  function getUShortAttr(name, value) {
    return getIntAttr(name, value, 0, 65535)
  }

  function getShortAttr(name, value) {
    return getIntAttr(name, value, -32768, 32767)
  }

  function getEnumIntAttr(name, value, regex, min, max) {
    if (!regex.test(value)) {
      if (isNaN(value) || value < min || value > max) {
        throw new Error('Parameter "' + name + '" is invalid')
      }
    }
    return " " + name + '="' + value + '"'
  }

  function ePOSPrint(address) {
    this.address = address;
    this.enabled = false;
    this.interval = 3000;
    this.timeout = 300000;
    this.status = 0;
    this.battery = 0;
    this.drawerOpenLevel = 0;
    this.onreceive = null;
    this.onerror = null;
    this.onstatuschange = null;
    this.ononline = null;
    this.onoffline = null;
    this.onpoweroff = null;
    this.oncoverok = null;
    this.oncoveropen = null;
    this.onpaperok = null;
    this.onpaperend = null;
    this.onpapernearend = null;
    this.ondrawerclosed = null;
    this.ondraweropen = null;
    this.onbatterylow = null;
    this.onbatteryok = null;
    this.onbatterystatuschange = null;
    this.ASB_NO_RESPONSE = 1;
    this.ASB_PRINT_SUCCESS = 2;
    this.ASB_DRAWER_KICK = 4;
    this.ASB_BATTERY_OFFLINE = 4;
    this.ASB_OFF_LINE = 8;
    this.ASB_COVER_OPEN = 32;
    this.ASB_PAPER_FEED = 64;
    this.ASB_WAIT_ON_LINE = 256;
    this.ASB_PANEL_SWITCH = 512;
    this.ASB_MECHANICAL_ERR = 1024;
    this.ASB_AUTOCUTTER_ERR = 2048;
    this.ASB_UNRECOVER_ERR = 8192;
    this.ASB_AUTORECOVER_ERR = 16384;
    this.ASB_RECEIPT_NEAR_END = 131072;
    this.ASB_RECEIPT_END = 524288;
    this.ASB_BUZZER = 16777216;
    this.ASB_WAIT_REMOVE_LABEL = 16777216;
    this.ASB_NO_LABEL = 67108864;
    this.ASB_SPOOLER_IS_STOPPED = 2147483648;
    this.DRAWER_OPEN_LEVEL_LOW = 0;
    this.DRAWER_OPEN_LEVEL_HIGH = 1
  }
  ePOSPrint.prototype = new ePOSBuilder();
  ePOSPrint.prototype.constructor = ePOSPrint;
  ePOSPrint.prototype.open = function() {
    if (!this.enabled) {
      this.enabled = true;
      this.status = 0;
      this.battery = 0;
      this.send()
    }
  };
  ePOSPrint.prototype.close = function() {
    this.enabled = false;
    if (this.intervalid) {
      clearTimeout(this.intervalid);
      delete this.intervalid
    }
    if (this.intervalxhr) {
      this.intervalxhr.abort();
      delete this.intervalxhr
    }
  };
  ePOSPrint.prototype.getPrintJobStatus = function(printjobid) {
    this.send(printjobid)
  };
  ePOSPrint.prototype.send = function(request, printjobid) {
    var args = arguments.length,
      epos = this,
      address = epos.address,
      soap, xhr, tid, res, success, code, status, battery;
    if (!/^<epos/.test(request)) {
      if (args < 2) {
        printjobid = request;
        request = new ePOSBuilder().toString()
      } else {
        address = request;
        request = printjobid;
        printjobid = arguments[2]
      }
    }
    soap = '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">';
    if (printjobid) {
      soap += '<s:Header><parameter xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><printjobid>' + printjobid + "</printjobid></parameter></s:Header>"
    }
    soap += "<s:Body>" + request + "</s:Body></s:Envelope>";
    if (window.XMLHttpRequest) {
      xhr = new XMLHttpRequest();
      if (!("withCredentials" in xhr) && window.XDomainRequest) {
        xhr = new XDomainRequest();
        xhr.open("POST", address, true);
        xhr.onload = function() {
          res = xhr.responseText;
          if (/response/.test(res)) {
            success = /success\s*=\s*"\s*(1|true)\s*"/.test(res);
            code = res.match(/code\s*=\s*"\s*(\S*)\s*"/) ? RegExp.$1 : "";
            status = res.match(/status\s*=\s*"\s*(\d+)\s*"/) ? parseInt(RegExp.$1) : 0;
            battery = res.match(/battery\s*=\s*"\s*(\d+)\s*"/) ? parseInt(RegExp.$1) : 0;
            printjobid = res.match(/<printjobid>\s*(\S*)\s*<\/printjobid>/) ? RegExp.$1 : "";
            if (args > 0) {
              fireReceiveEvent(epos, success, code, status, battery, printjobid)
            } else {
              fireStatusEvent(epos, status, battery)
            }
          } else {
            if (args > 0) {
              fireErrorEvent(epos, 0, xhr.responseText)
            } else {
              fireStatusEvent(epos, epos.ASB_NO_RESPONSE, 0)
            }
          }
          if (args < 1) {
            updateStatus(epos)
          }
        };
        xhr.onerror = function() {
          if (args > 0) {
            fireErrorEvent(epos, 0, xhr.responseText)
          } else {
            fireStatusEvent(epos, epos.ASB_NO_RESPONSE, 0);
            updateStatus(epos)
          }
        };
        xhr.onprogress = function() {};
        xhr.ontimeout = xhr.onerror;
        xhr.timeout = epos.timeout;
        xhr.send(soap)
      } else {
        xhr.open("POST", address, true);
        xhr.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
        xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT");
        xhr.setRequestHeader("SOAPAction", '""');
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4) {
            clearTimeout(tid);
            if (xhr.status == 200 && xhr.responseXML) {
              res = xhr.responseXML.getElementsByTagName("response");
              if (res.length > 0) {
                success = /^(1|true)$/.test(res[0].getAttribute("success"));
                code = res[0].hasAttribute("code") ? res[0].getAttribute("code") : "";
                status = res[0].hasAttribute("status") ? parseInt(res[0].getAttribute("status")) : 0;
                battery = res[0].hasAttribute("battery") ? parseInt(res[0].getAttribute("battery")) : 0;
                res = xhr.responseXML.getElementsByTagName("printjobid");
                printjobid = res.length > 0 ? res[0].textContent : "";
                if (args > 0) {
                  fireReceiveEvent(epos, success, code, status, battery, printjobid)
                } else {
                  fireStatusEvent(epos, status, battery)
                }
              } else {
                if (args > 0) {
                  fireErrorEvent(epos, xhr.status, xhr.responseText)
                } else {
                  fireStatusEvent(epos, epos.ASB_NO_RESPONSE, 0)
                }
              }
            } else {
              if (args > 0) {
                fireErrorEvent(epos, xhr.status, xhr.responseText)
              } else {
                fireStatusEvent(epos, epos.ASB_NO_RESPONSE, 0)
              }
            }
            if (args < 1) {
              updateStatus(epos)
            }
          }
        };
        tid = setTimeout(function() {
          xhr.abort()
        }, epos.timeout);
        xhr.send(soap)
      }
      if (args < 1) {
        epos.intervalxhr = xhr
      }
    } else {
      throw new Error("XMLHttpRequest is not supported")
    }
  };

  function fireReceiveEvent(epos, success, code, status, battery, printjobid) {
    if (code == "EX_ENPC_TIMEOUT") {
      code = "ERROR_DEVICE_BUSY"
    }
    if (epos.onreceive) {
      epos.onreceive({
        success: success,
        code: code,
        status: status,
        battery: battery,
        printjobid: printjobid
      })
    }
  }

  function fireStatusEvent(epos, status, battery) {
    var diff, difb;
    if (status == 0 || status == epos.ASB_NO_RESPONSE) {
      status = epos.status | epos.ASB_NO_RESPONSE
    }
    diff = epos.status == 0 ? ~0 : epos.status ^ status;
    difb = epos.status == 0 ? ~0 : epos.battery ^ battery;
    epos.status = status;
    epos.battery = battery;
    if (diff && epos.onstatuschange) {
      epos.onstatuschange(status)
    }
    if (difb && epos.onbatterystatuschange) {
      epos.onbatterystatuschange(battery)
    }
    if (diff & (epos.ASB_NO_RESPONSE | epos.ASB_OFF_LINE)) {
      if (status & epos.ASB_NO_RESPONSE) {
        if (epos.onpoweroff) {
          epos.onpoweroff()
        }
      } else {
        if (status & epos.ASB_OFF_LINE) {
          if (epos.onoffline) {
            epos.onoffline()
          }
        } else {
          if (epos.ononline) {
            epos.ononline()
          }
        }
      }
    }
    if (diff & epos.ASB_COVER_OPEN) {
      if (status & epos.ASB_NO_RESPONSE) {} else {
        if (status & epos.ASB_COVER_OPEN) {
          if (epos.oncoveropen) {
            epos.oncoveropen()
          }
        } else {
          if (epos.oncoverok) {
            epos.oncoverok()
          }
        }
      }
    }
    if (diff & (epos.ASB_RECEIPT_END | epos.ASB_RECEIPT_NEAR_END)) {
      if (status & epos.ASB_NO_RESPONSE) {} else {
        if (status & epos.ASB_RECEIPT_END) {
          if (epos.onpaperend) {
            epos.onpaperend()
          }
        } else {
          if (status & epos.ASB_RECEIPT_NEAR_END) {
            if (epos.onpapernearend) {
              epos.onpapernearend()
            }
          } else {
            if (epos.onpaperok) {
              epos.onpaperok()
            }
          }
        }
      }
    }
    if (diff & epos.ASB_DRAWER_KICK) {
      if (status & epos.ASB_NO_RESPONSE) {} else {
        if (status & epos.ASB_DRAWER_KICK) {
          if (epos.drawerOpenLevel == epos.DRAWER_OPEN_LEVEL_HIGH) {
            if (epos.ondraweropen) {
              epos.ondraweropen()
            }
          } else {
            if (epos.ondrawerclosed) {
              epos.ondrawerclosed()
            }
          }
          if (epos.onbatterylow) {
            epos.onbatterylow()
          }
        } else {
          if (epos.drawerOpenLevel == epos.DRAWER_OPEN_LEVEL_HIGH) {
            if (epos.ondrawerclosed) {
              epos.ondrawerclosed()
            }
          } else {
            if (epos.ondraweropen) {
              epos.ondraweropen()
            }
          }
          if (epos.onbatteryok) {
            epos.onbatteryok()
          }
        }
      }
    }
  }

  function fireErrorEvent(epos, status, responseText) {
    if (epos.onerror) {
      epos.onerror({
        status: status,
        responseText: responseText
      })
    }
  }

  function updateStatus(epos) {
    var delay = epos.interval;
    if (epos.enabled) {
      if (isNaN(delay) || delay < 1000) {
        delay = 3000
      }
      epos.intervalid = setTimeout(function() {
        delete epos.intervalid;
        if (epos.enabled) {
          epos.send()
        }
      }, delay)
    }
    delete epos.intervalxhr
  }

  function CanvasPrint(address) {
    this.address = address;
    this.mode = "mono";
    this.halftone = 0;
    this.brightness = 1;
    this.align = "left";
    this.color = "color_1";
    this.paper = "receipt";
    this.feed = "current_tof";
    this.cut = false;
    this.layout = null;
    this.ALIGN_LEFT = "left";
    this.ALIGN_CENTER = "center";
    this.ALIGN_RIGHT = "right";
    this.COLOR_NONE = "none";
    this.COLOR_1 = "color_1";
    this.COLOR_2 = "color_2";
    this.COLOR_3 = "color_3";
    this.COLOR_4 = "color_4";
    this.FEED_PEELING = "peeling";
    this.FEED_CUTTING = "cutting";
    this.FEED_CURRENT_TOF = "current_tof";
    this.FEED_NEXT_TOF = "next_tof";
    this.HALFTONE_DITHER = 0;
    this.HALFTONE_ERROR_DIFFUSION = 1;
    this.HALFTONE_THRESHOLD = 2;
    this.MODE_MONO = "mono";
    this.MODE_GRAY16 = "gray16";
    this.PAPER_RECEIPT = "receipt";
    this.PAPER_RECEIPT_BM = "receipt_bm";
    this.PAPER_LABEL = "label";
    this.PAPER_LABEL_BM = "label_bm";
    this.connectionObj = null
  }
  CanvasPrint.prototype = new ePOSPrint();
  CanvasPrint.prototype.constructor = CanvasPrint;
  CanvasPrint.prototype.setConnectionObject = function(connectionObj) {
    this.connectionObj = connectionObj
  };
  CanvasPrint.prototype.print = function() {
    var args = arguments.length;
    var address = this.address,
      layout = this.layout,
      paper = this.paper;
    var canvas = arguments[0],
      cut = this.cut,
      mode = this.mode,
      printjobid = undefined;
    switch (args) {
      case 2:
        printjobid = arguments[1];
        break;
      case 4:
        printjobid = arguments[3];
      case 3:
        cut = arguments[1];
        mode = arguments[2];
        break
    }
    if ((typeof(canvas) == "undefined") || (canvas == null)) {
      throw new Error("Canvas is not supported")
    }
    if (!canvas.getContext) {
      throw new Error("Canvas is not supported")
    }
    if (layout) {
      this.addLayout(paper, layout.width, layout.height, layout.margin_top, layout.margin_bottom, layout.offset_cut, layout.offset_label)
    }
    if (paper != this.PAPER_RECEIPT) {
      this.addFeedPosition(this.FEED_CURRENT_TOF);
      if (layout) {
        this.addFeedPosition(this.FEED_NEXT_TOF)
      }
    }
    this.addTextAlign(this.align);
    this.addImage(canvas.getContext("2d"), 0, 0, canvas.width, canvas.height, this.color, mode);
    if (paper != this.PAPER_RECEIPT) {
      this.addFeedPosition(this.feed);
      if (cut) {
        this.addCut(this.CUT_NO_FEED)
      }
    } else {
      if (cut) {
        this.addCut(this.CUT_FEED)
      }
    }
    this.send(printjobid)
  };
  CanvasPrint.prototype.recover = function() {
    this.force = true;
    this.addRecovery();
    this.send()
  };
  CanvasPrint.prototype.reset = function() {
    this.addReset();
    this.send()
  };
  if (!window.epson) {
    window.epson = {}
  }
  window.epson.ePOSBuilder = ePOSBuilder;
  window.epson.ePOSPrint = ePOSPrint;
  window.epson.CanvasPrint = CanvasPrint;

  function POSKeyboard(deviceID, isCrypto) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connectionObj = null
  }
  POSKeyboard.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    client_onkeypress: function(data) {
      try {
        if (this.onkeypress == null) {
          return
        }
        this.onkeypress(data)
      } catch (e) {}
      return
    },
    callEvent: function(eventName, data) {
      var eventReq = data;
      eventReq.type = eventName;
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, eventReq, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    }
  };

  function Printer(deviceID, isCrypto, ePOSDeviceContext) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.ePosDev = ePOSDeviceContext;
    this.timeout = 10000
  }
  Printer.prototype = new CanvasPrint();
  Printer.prototype.finalize = function() {
    this.stopMonitor()
  };
  Printer.prototype.toString = function() {
    var str = ePOSBuilder.prototype.toString.apply(this);
    return str
  };
  Printer.prototype.addFeedUnit = function(unit) {
    try {
      ePOSBuilder.prototype.addFeedUnit.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addFeedLine = function(line) {
    try {
      ePOSBuilder.prototype.addFeedLine.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addFeed = function(unit) {
    try {
      ePOSBuilder.prototype.addFeed.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addFeedPosition = function(line) {
    try {
      ePOSBuilder.prototype.addFeedPosition.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addText = function(text) {
    try {
      ePOSBuilder.prototype.addText.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextLang = function(lang) {
    try {
      ePOSBuilder.prototype.addTextLang.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextAlign = function(align) {
    try {
      ePOSBuilder.prototype.addTextAlign.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextRotate = function(rotate) {
    try {
      ePOSBuilder.prototype.addTextRotate.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextLineSpace = function(linespc) {
    try {
      ePOSBuilder.prototype.addTextLineSpace.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextFont = function(font) {
    try {
      ePOSBuilder.prototype.addTextFont.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextSmooth = function(smooth) {
    try {
      ePOSBuilder.prototype.addTextSmooth.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextDouble = function(dw, dh) {
    try {
      ePOSBuilder.prototype.addTextDouble.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextSize = function(width, height) {
    try {
      ePOSBuilder.prototype.addTextSize.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextStyle = function(reverse, ul, em, color) {
    try {
      ePOSBuilder.prototype.addTextStyle.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextPosition = function(x) {
    try {
      ePOSBuilder.prototype.addTextPosition.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addTextVPosition = function(y) {
    try {
      ePOSBuilder.prototype.addTextVPosition.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addImage = function(context, x, y, width, height, color, mode) {
    try {
      ePOSBuilder.prototype.addImage.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addLogo = function(key1, key2) {
    try {
      ePOSBuilder.prototype.addLogo.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addBarcode = function(barCodeData, type, hri, font, width, height) {
    try {
      ePOSBuilder.prototype.addBarcode.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addSymbol = function(symbolData, type, level, width, height, size) {
    try {
      ePOSBuilder.prototype.addSymbol.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addCommand = function(data) {
    try {
      ePOSBuilder.prototype.addCommand.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addHLine = function(x1, x2, style) {
    try {
      ePOSBuilder.prototype.addHLine.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addVLineBegin = function(x, style) {
    try {
      ePOSBuilder.prototype.addVLineBegin.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addVLineEnd = function(x, style) {
    try {
      ePOSBuilder.prototype.addVLineEnd.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addPageBegin = function() {
    try {
      ePOSBuilder.prototype.addPageBegin.apply(this)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addPageEnd = function() {
    try {
      ePOSBuilder.prototype.addPageEnd.apply(this)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addPageArea = function(x, y, width, height) {
    try {
      ePOSBuilder.prototype.addPageArea.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addPageDirection = function(dir) {
    try {
      ePOSBuilder.prototype.addPageDirection.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addPagePosition = function(x, y) {
    try {
      ePOSBuilder.prototype.addPagePosition.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addPageLine = function(x1, y1, x2, y2, style) {
    try {
      ePOSBuilder.prototype.addPageLine.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addPageRectangle = function(x1, y1, x2, y2, style) {
    try {
      ePOSBuilder.prototype.addPageRectangle.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addRotateBegin = function() {
    try {
      ePOSBuilder.prototype.addRotateBegin.apply(this)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addRotateEnd = function() {
    try {
      ePOSBuilder.prototype.addRotateEnd.apply(this)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addCut = function(type) {
    try {
      ePOSBuilder.prototype.addCut.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addPulse = function(drawer, time) {
    try {
      ePOSBuilder.prototype.addPulse.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addSound = function(pattern, repeat, cycle) {
    try {
      ePOSBuilder.prototype.addSound.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.addLayout = function(type, width, height, margin_top, margin_bottom, offset_cut, offset_label) {
    try {
      ePOSBuilder.prototype.addLayout.apply(this, arguments)
    } catch (e) {
      throw e
    }
    return this
  };
  Printer.prototype.setXmlString = function(xml) {
    this.message = xml
  };
  Printer.prototype.getXmlString = function() {
    return this.message
  };
  Printer.prototype.getPrintJobStatus = function(printjobid) {
    this.setXmlString("");
    this.send(printjobid)
  };
  Printer.prototype.send = function(printjobid) {
    var sq = -1;
    if ((!this.ePosDev.eposprint) && (this.connectionObj.isUsableDeviceIF())) {
      try {
        var data = {
          type: "print",
          timeout: this.timeout,
          printdata: this.toString()
        };
        switch (arguments.length) {
          case 0:
            data.printdata = this.toString();
            break;
          case 1:
            data.printdata = this.toString();
            data.printjobid = printjobid;
            break;
          case 2:
          case 3:
            data.printdata = arguments[1];
            data.printjobid = arguments[2]
        }
        var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
        var sequence = -1;
        try {
          this.connectionObj.emit(eposmsg);
          sequence = eposmsg.sequence
        } catch (e) {}
        this.force = false;
        this.setXmlString("")
      } catch (e) {
        sq = -1
      }
    } else {
      var self = this,
        address = this.connectionObj.getAddressWithProtocol() + "/cgi-bin/epos/service.cgi?devid=" + this.deviceID + "&timeout=" + this.timeout,
        soap, xhr, tid, res, success, code, status, battery;
      soap = '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">';
      if (printjobid) {
        soap += '<s:Header><parameter xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"><printjobid>' + printjobid + "</printjobid></parameter></s:Header>"
      }
      soap += "<s:Body>" + this.toString() + "</s:Body></s:Envelope>";
      if (window.XMLHttpRequest) {
        xhr = new XMLHttpRequest();
        if (!("withCredentials" in xhr) && window.XDomainRequest) {
          xhr = new XDomainRequest();
          xhr.open("POST", address, true);
          xhr.onload = function() {
            res = xhr.responseText;
            if (/response/.test(res)) {
              success = /success\s*=\s*"\s*(1|true)\s*"/.test(res);
              code = res.match(/code\s*=\s*"\s*(\S*)\s*"/) ? RegExp.$1 : "";
              status = res.match(/status\s*=\s*"\s*(\d+)\s*"/) ? parseInt(RegExp.$1) : 0;
              battery = res.match(/battery\s*=\s*"\s*(\d+)\s*"/) ? parseInt(RegExp.$1) : 0;
              printjobid = res.match(/<printjobid>\s*(\S*)\s*<\/printjobid>/) ? RegExp.$1 : "";
              self.fireReceiveEvent(success, code, status, battery, printjobid, 0)
            } else {
              self.fireErrorEvent(0, xhr.responseText, 0)
            }
          };
          xhr.onerror = function() {
            self.fireErrorEvent(0, xhr.responseText, 0)
          };
          xhr.onprogress = function() {};
          xhr.ontimeout = xhr.onerror;
          xhr.timeout = self.timeout;
          xhr.send(soap)
        } else {
          xhr.open("POST", address, true);
          xhr.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
          xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT");
          xhr.setRequestHeader("SOAPAction", '""');
          xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
              clearTimeout(tid);
              if (xhr.status == 200 && xhr.responseXML) {
                res = xhr.responseXML.getElementsByTagName("response");
                if (res.length > 0) {
                  success = /^(1|true)$/.test(res[0].getAttribute("success"));
                  code = res[0].hasAttribute("code") ? res[0].getAttribute("code") : "";
                  status = res[0].hasAttribute("status") ? parseInt(res[0].getAttribute("status")) : 0;
                  battery = res[0].hasAttribute("battery") ? parseInt(res[0].getAttribute("battery")) : 0;
                  res = xhr.responseXML.getElementsByTagName("printjobid");
                  printjobid = res.length > 0 ? res[0].textContent : "";
                  self.fireReceiveEvent(success, code, status, battery, printjobid, 0)
                } else {
                  self.fireErrorEvent(xhr.status, xhr.responseText, 0)
                }
              } else {
                self.fireErrorEvent(xhr.status, xhr.responseText, 0)
              }
            }
          };
          tid = setTimeout(function() {
            xhr.abort()
          }, this.timeout);
          xhr.send(soap)
        }
        this.setXmlString("")
      } else {
        throw new Error("XMLHttpRequest is not supported")
      }
      sq = 0
    }
    return sq
  };
  Printer.prototype.client_onxmlresult = function(res, sq) {
    if (res) {
      var xml = res.resultdata;
      var success = /success\s*=\s*"\s*(1|true)\s*"/.test(xml);
      xml.match(/code\s*=\s*"\s*(\S*)\s*"/);
      var code = RegExp.$1;
      xml.match(/status\s*=\s*"\s*(\d+)\s*"/);
      var status = parseInt(RegExp.$1);
      xml.match(/battery\s*=\s*"\s*(\d+)\s*"/);
      var battery = parseInt(RegExp.$1);
      this.fireReceiveEvent(success, code, status, battery, res.printjobid, sq)
    } else {
      this.fireErrorEvent(0, this.ASB_NO_RESPONSE, sq)
    }
  };
  Printer.prototype.startMonitor = function() {
    var result = false;
    var address = this.connectionObj.getAddressWithProtocol() + "/cgi-bin/epos/service.cgi?devid=" + this.deviceID + "&timeout=10000";
    try {
      if (!this.enabled) {
        this.address = address;
        this.enabled = true;
        this.status = this.ASB_DRAWER_KICK;
        this.sendStartMonitorCommand()
      }
      result = true
    } catch (e) {
      throw e
    }
    return result
  };
  Printer.prototype.sendStartMonitorCommand = function() {
    var self = this;
    var address = this.address;
    var request = new ePOSBuilder().toString();
    var soap = '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' + request + "</s:Body></s:Envelope>";
    var epos = this;
    if (window.XDomainRequest) {
      var xdr = new XDomainRequest();
      xdr.open("POST", address, true);
      xdr.onload = function() {
        var res = xdr.responseText;
        if (/response/.test(res)) {
          var success = /success\s*=\s*"\s*(1|true)\s*"/.test(res);
          res.match(/code\s*=\s*"\s*(\S*)\s*"/);
          var code = RegExp.$1;
          res.match(/status\s*=\s*"\s*(\d+)\s*"/);
          var status = parseInt(RegExp.$1);
          res.match(/battery\s*=\s*"\s*(\d+)\s*"/);
          var battery = parseInt(RegExp.$1);
          self.fireStatusEvent(epos, status, battery)
        } else {
          self.fireStatusEvent(epos, epos.ASB_NO_RESPONSE, 0)
        }
        self.updateStatus(epos)
      };
      xdr.onerror = function() {
        self.fireStatusEvent(epos, epos.ASB_NO_RESPONSE, 0);
        self.updateStatus(epos)
      };
      xdr.onprogress = function() {};
      xdr.ontimeout = xdr.onerror;
      xdr.send(soap)
    } else {
      if (window.XMLHttpRequest) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", address, true);
        xhr.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
        xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT");
        xhr.setRequestHeader("SOAPAction", '""');
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4) {
            if (xhr.status == 200 && xhr.responseXML) {
              var res = xhr.responseXML.getElementsByTagName("response");
              if (res.length > 0) {
                var success = /^(1|true)$/.test(res[0].getAttribute("success"));
                var code = res[0].getAttribute("code");
                var status = parseInt(res[0].getAttribute("status"));
                var battery = res[0].hasAttribute("battery") ? parseInt(res[0].getAttribute("battery")) : 0;
                self.fireStatusEvent(epos, status, battery)
              } else {
                self.fireStatusEvent(epos, epos.ASB_NO_RESPONSE, 0)
              }
            } else {
              self.fireStatusEvent(epos, epos.ASB_NO_RESPONSE, 0)
            }
            self.updateStatus(epos)
          }
        };
        xhr.send(soap)
      } else {
        throw new Error("XMLHttpRequest is not supported")
      }
    }
  };
  Printer.prototype.stopMonitor = function() {
    var result = false;
    try {
      this.enabled = false;
      if (this.timeoutid) {
        clearTimeout(this.timeoutid);
        delete this.timeoutid
      }
      result = true
    } catch (e) {
      throw e
    }
    return result
  };
  Printer.prototype.fireReceiveEvent = function(success, code, status, battery, printjobid, sq) {
    delete this.isPrint;
    if (code == "EX_ENPC_TIMEOUT") {
      code = "ERROR_DEVICE_BUSY"
    }
    if (this.onreceive) {
      this.onreceive({
        success: success,
        code: code,
        status: status,
        battery: battery,
        printjobid: printjobid
      }, sq)
    }
  };
  Printer.prototype.fireErrorEvent = function(status, responseText, sq) {
    if (this.onerror) {
      this.onerror({
        status: status,
        responseText: responseText
      }, sq)
    }
    this.ePosDev.cleanup()
  };
  Printer.prototype.fireStatusEvent = function(epos, status, battery) {
    if (status == 0 || status == this.ASB_NO_RESPONSE) {
      status = this.status | this.ASB_NO_RESPONSE
    }
    var diff = this.status == this.ASB_DRAWER_KICK ? ~0 : this.status ^ status;
    var difb = this.status == 0 ? ~0 : this.battery ^ battery;
    this.status = status;
    this.battery = battery;
    if (diff && this.onstatuschange) {
      this.onstatuschange(status)
    }
    if (difb && this.onbatterystatuschange) {
      this.onbatterystatuschange(battery)
    }
    if (diff & (this.ASB_NO_RESPONSE | this.ASB_OFF_LINE)) {
      if (status & this.ASB_NO_RESPONSE) {
        if (this.onpoweroff) {
          this.onpoweroff()
        }
      } else {
        if (status & this.ASB_OFF_LINE) {
          if (this.onoffline) {
            this.onoffline()
          }
        } else {
          if (this.ononline) {
            this.ononline()
          }
        }
      }
    }
    if (diff & this.ASB_COVER_OPEN) {
      if (status & this.ASB_NO_RESPONSE) {} else {
        if (status & this.ASB_COVER_OPEN) {
          if (this.oncoveropen) {
            this.oncoveropen()
          }
        } else {
          if (this.oncoverok) {
            this.oncoverok()
          }
        }
      }
    }
    if (diff & (this.ASB_RECEIPT_END | this.ASB_RECEIPT_NEAR_END)) {
      if (status & this.ASB_NO_RESPONSE) {} else {
        if (status & this.ASB_RECEIPT_END) {
          if (this.onpaperend) {
            this.onpaperend()
          }
        } else {
          if (status & this.ASB_RECEIPT_NEAR_END) {
            if (this.onpapernearend) {
              this.onpapernearend()
            }
          } else {
            if (this.onpaperok) {
              this.onpaperok()
            }
          }
        }
      }
    }
    if (diff & this.ASB_DRAWER_KICK) {
      if (status & this.ASB_NO_RESPONSE) {} else {
        if (status & this.ASB_DRAWER_KICK) {
          if (this.drawerOpenLevel == this.DRAWER_OPEN_LEVEL_HIGH) {
            if (this.ondraweropen) {
              this.ondraweropen()
            }
          } else {
            if (this.ondrawerclosed) {
              this.ondrawerclosed()
            }
          }
          if (this.onbatterylow) {
            this.onbatterylow()
          }
        } else {
          if (this.drawerOpenLevel == this.DRAWER_OPEN_LEVEL_HIGH) {
            if (this.ondrawerclosed) {
              this.ondrawerclosed()
            }
          } else {
            if (this.ondraweropen) {
              this.ondraweropen()
            }
          }
          if (this.onbatteryok) {
            this.onbatteryok()
          }
        }
      }
    }
  };
  Printer.prototype.updateStatus = function() {
    var self = this;
    if (this.enabled) {
      var delay = this.interval;
      if (isNaN(delay) || delay < 1000) {
        delay = 3000
      }
      this.timeoutid = setTimeout(function() {
        delete self.timeoutid;
        if (self.enabled) {
          self.sendStartMonitorCommand()
        }
      }, delay)
    }
  };
  Printer.prototype.print = function(canvas, cut, mode, printjobid) {
    try {
      CanvasPrint.prototype.print.apply(this, arguments)
    } catch (e) {
      throw e
    }
  };
  Printer.prototype.reset = function() {
    try {
      CanvasPrint.prototype.reset.apply(this, arguments)
    } catch (e) {
      throw e
    }
  };
  Printer.prototype.recover = function() {
    try {
      CanvasPrint.prototype.recover.apply(this, arguments)
    } catch (e) {
      throw e
    }
  };

  function HybridPrinter(deviceID, isCrypto, ePOSDeviceContext) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.ePosDev = ePOSDeviceContext;
    this.connectionObj = null;
    this.ReceiptPrinter;
    this.SlipPrinter;
    this.EndorsePrinter;
    this.MICRReader;
    this.force = false;
    this.onstatuschange;
    this.ononline;
    this.onoffline;
    this.onpoweroff;
    this.oncoveropen;
    this.onpaperok;
    this.onpapernearend;
    this.onpaperend;
    this.ondrawerclosed;
    this.ondraweropen;
    this.ASB_NO_RESPONSE = 1;
    this.ASB_PRINT_SUCCESS = 2;
    this.ASB_DRAWER_KICK = 4;
    this.ASB_OFF_LINE = 8;
    this.ASB_COVER_OPEN = 32;
    this.ASB_PAPER_FEED = 64;
    this.ASB_WAIT_ON_LINE = 256;
    this.ASB_PANEL_SWITCH = 512;
    this.ASB_MECHANICAL_ERR = 1024;
    this.ASB_AUTOCUTTER_ERR = 2048;
    this.ASB_UNRECOVER_ERR = 8192;
    this.ASB_AUTORECOVER_ERR = 16384;
    this.ASB_RECEIPT_NEAR_END = 131072;
    this.ASB_RECEIPT_END = 524288;
    this.ASB_TOF_NOPAPER = 2097152;
    this.ASB_BOF_NOPAPER = 4194304;
    this.ASB_SLIP_NO_SELECT = 16777216;
    this.ASB_SLIP_IMPOSSIBLE_PRINT = 33554432;
    this.ASB_SPOOLER_IS_STOPPED = 2147483648;
    this.SUCCESS = "SUCCESS";
    this.CANCEL = "CANCEL";
    this.ERROR_PARAMMETER = "ERROR_PARAMMETER";
    this.ERROR_COMMAND = "ERROR_COMMAND";
    this.ERROR_DEVICE_NOT_FOUND = "ERROR_DEVICE_NOT_FOUND";
    this.ERROR_DEVICE_BUSY = "ERROR_DEVICE_BUSY";
    this.ERROR_NOT_SUPPORTED = "ERROR_NOT_SUPPORTED";
    this.ERROR_COVER_OPEN = "ERROR_COVER_OPEN";
    this.ERROR_TIMEOUT = "ERROR_TIMEOUT";
    this.ERROR_AUTOMATICAL = "ERROR_AUTOMATICAL";
    this.ERROR_UNRECOVERABLE = "ERROR_UNRECOVERABLE";
    this.ERROR_BADPORT = "ERROR_BADPORT";
    this.SYSTEM_ERROR = "SYSTEM_ERROR";
    this.init(deviceID)
  }
  HybridPrinter.prototype = {
    init: function(deviceID) {
      var obj = this;
      obj.deviceID = deviceID;
      obj.ReceiptPrinter = new ReceiptPrinter(this);
      obj.SlipPrinter = new SlipPrinter(this);
      obj.EndorsePrinter = new EndorsePrinter(this);
      obj.MICRReader = new MICRReader(this);
      obj.ReceiptPrinter.onstatuschange = function(status) {
        if (obj.onstatuschange != null) {
          obj.onstatuschange(status)
        }
      };
      obj.ReceiptPrinter.ononline = function() {
        if (obj.ononline != null) {
          obj.ononline()
        }
      };
      obj.ReceiptPrinter.onoffline = function() {
        if (obj.onoffline != null) {
          obj.onoffline()
        }
      };
      obj.ReceiptPrinter.onpoweroff = function() {
        if (obj.onpoweroff != null) {
          obj.onpoweroff()
        }
      };
      obj.ReceiptPrinter.oncoveropen = function() {
        if (obj.oncoveropen != null) {
          obj.oncoveropen()
        }
      };
      obj.ReceiptPrinter.onpaperok = function() {
        if (obj.onpaperok != null) {
          obj.onpaperok()
        }
      };
      obj.ReceiptPrinter.onpapernearend = function() {
        if (obj.onpapernearend != null) {
          obj.onpapernearend()
        }
      };
      obj.ReceiptPrinter.onpaperend = function() {
        if (obj.onpaperend != null) {
          obj.onpaperend()
        }
      };
      obj.ReceiptPrinter.ondrawerclosed = function() {
        if (obj.ondrawerclosed != null) {
          obj.ondrawerclosed()
        }
      };
      obj.ReceiptPrinter.ondraweropen = function() {
        if (obj.ondraweropen != null) {
          obj.ondraweropen()
        }
      }
    },
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj;
      this.ReceiptPrinter.setConnectionObject(this.connectionObj)
    },
    lock: function() {
      var data = {
        type: "lock"
      };
      return this.send(data)
    },
    unlock: function() {
      var data = {
        type: "unlock"
      };
      return this.send(data)
    },
    eject: function() {
      var data = {
        type: "eject"
      };
      return this.send(data)
    },
    recover: function() {
      return this.ReceiptPrinter.recover()
    },
    reset: function() {
      this.ReceiptPrinter.force = this.force;
      var ret = this.ReceiptPrinter.reset();
      this.force = false;
      return ret
    },
    startMonitor: function() {
      return this.ReceiptPrinter.startMonitor()
    },
    stopMonitor: function() {
      return this.ReceiptPrinter.stopMonitor()
    },
    client_onreceive: function(res, sq) {
      switch (res.eventtype) {
        case "slipprint":
        case "slipcancel":
          this.SlipPrinter.fireOnReceive(res, sq);
          break;
        case "endorseprint":
        case "endorsecancel":
          this.EndorsePrinter.fireOnReceive(res, sq);
          break;
        case "micrread":
        case "micrcleaning":
        case "micrcancel":
          this.MICRReader.fireOnReceive(res, sq);
          break;
        case "print":
          var tmp = res;
          tmp.eventtype = this.ReceiptPrinter.methodName;
          this.fireOnReceive(tmp, sq);
          break;
        default:
          this.fireOnReceive(res, sq);
          break
      }
    },
    client_onxmlresult: function(res, sq) {
      this.ReceiptPrinter.fireOnReceive(res, sq)
    },
    fireOnReceive: function(res, sq) {
      if (this.onreceive == null) {
        return
      }
      if (res == null) {
        return
      }
      this.onreceive({
        eventtype: res.eventtype,
        success: res.success,
        code: res.code,
        status: res.status
      }, sq)
    },
    callEvent: function(eventName, data) {
      var eventReq = data;
      eventReq.type = eventName;
      return this.send(eventReq)
    },
    send: function(data) {
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    }
  };

  function ReceiptPrinter(parent) {
    this.parent = parent;
    this.methodName = "";
    this.deviceID = this.parent.deviceID;
    this.ePosDev = this.parent.ePosDev;
    this.connectionObj = null;
    this.SUCCESS = "SUCCESS";
    this.CANCEL = "CANCEL";
    this.ERROR_PARAMMETER = "ERROR_PARAMMETER";
    this.ERROR_COMMAND = "ERROR_COMMAND";
    this.ERROR_DEVICE_NOT_FOUND = "DeviceNotFound";
    this.ERROR_DEVICE_BUSY = "ERROR_DEVICE_BUSY";
    this.ERROR_NOT_SUPPORTED = "ERROR_NOT_SUPPORTED";
    this.ERROR_COVER_OPEN = "EPTR_COVER_OPEN";
    this.ERROR_TIMEOUT = "EX_TIMEOUT";
    this.ERROR_AUTOMATICAL = "EPTR_AUTOMATICAL";
    this.ERROR_UNRECOVERABLE = "EPTR_UNRECOVERABLE";
    this.ERROR_BADPORT = "EX_BADPORT";
    this.SYSTEM_ERROR = "SYSTEM_ERROR";
    this.EPTR_CUTTER = "EPTR_CUTTER";
    this.EPTR_MECHANICAL = "EPTR_MECHANICAL";
    this.EPTR_REC_EMPTY = "EPTR_REC_EMPTY";
    this.EPTR_SCHEMAERROR = "SchemaError";
    this.EPTR_PRINT_SYSTEM_ERROR = "PrintSystemError"
  }
  ReceiptPrinter.prototype.setConnectionObject = function(connectionObj) {
    this.connectionObj = connectionObj
  };
  ReceiptPrinter.prototype = new Printer();
  ReceiptPrinter.prototype.send = function() {
    if (this.methodName == "") {
      this.methodName = "send"
    }
    return Printer.prototype.send.apply(this, arguments)
  };
  ReceiptPrinter.prototype.print = function(canvas, cut, mode) {
    this.methodName = "print";
    return Printer.prototype.print.apply(this, arguments)
  };
  ReceiptPrinter.prototype.recover = function() {
    this.methodName = "recover";
    return Printer.prototype.recover.apply(this, arguments)
  };
  ReceiptPrinter.prototype.reset = function() {
    this.methodName = "reset";
    return Printer.prototype.reset.apply(this, arguments)
  };
  ReceiptPrinter.prototype.fireOnReceive = function(res, sq) {
    if (this.onreceive == null) {
      return
    }
    var eventtype = this.methodName;
    var success = "false";
    var code = "";
    var status = this.ASB_NO_RESPONSE;
    if (res) {
      var xml = res.resultdata;
      success = /success\s*=\s*"\s*(1|true)\s*"/.test(xml);
      xml.match(/code\s*=\s*"\s*(\S*)\s*"/);
      code = RegExp.$1;
      if (code == "") {
        code = (success) ? "SUCCESS" : "ERROR_DEVICE_NOT_FOUND"
      }
      xml.match(/status\s*=\s*"\s*(\d+)\s*"/);
      status = parseInt(RegExp.$1)
    }
    if (code == "EX_ENPC_TIMEOUT") {
      code = "ERROR_DEVICE_BUSY"
    }
    this.onreceive({
      eventtype: eventtype,
      success: success,
      code: code,
      status: status
    }, sq);
    this.methodName = ""
  };

  function SlipPrinter(parent) {
    this.parent = parent;
    this.SUCCESS = "SUCCESS";
    this.CANCEL = "CANCEL";
    this.ERROR_PARAMMETER = "ERROR_PARAMMETER";
    this.ERROR_COMMAND = "ERROR_COMMAND";
    this.ERROR_DEVICE_NOT_FOUND = "ERROR_DEVICE_NOT_FOUND";
    this.ERROR_DEVICE_BUSY = "ERROR_DEVICE_BUSY";
    this.ERROR_NOT_SUPPORTED = "ERROR_NOT_SUPPORTED";
    this.ERROR_COVER_OPEN = "ERROR_COVER_OPEN";
    this.ERROR_TIMEOUT = "ERROR_TIMEOUT";
    this.ERROR_AUTOMATICAL = "ERROR_AUTOMATICAL";
    this.ERROR_UNRECOVERABLE = "ERROR_UNRECOVERABLE";
    this.ERROR_BADPORT = "ERROR_BADPORT";
    this.SYSTEM_ERROR = "SYSTEM_ERROR";
    this.EPTR_CUTTER = "EPTR_CUTTER";
    this.EPTR_MECHANICAL = "EPTR_MECHANICAL";
    this.EPTR_REC_EMPTY = "EPTR_REC_EMPTY";
    this.EPTR_SCHEMAERROR = "EPTR_SCHEMAERROR";
    this.EPTR_PRINT_SYSTEM_ERROR = "EPTR_PRINT_SYSTEM_ERROR"
  }
  SlipPrinter.prototype = new ePOSBuilder();
  SlipPrinter.prototype.timeout = 60000;
  SlipPrinter.prototype.send = function() {
    var xml = (arguments.length < 1) ? this.toString() : arguments[1];
    var data = {
      type: "slipprint",
      timeout: this.timeout,
      printdata: xml
    };
    var sequence = this.parent.send(data);
    this.setXmlString("");
    return sequence
  };
  SlipPrinter.prototype.setXmlString = function(xml) {
    this.message = xml
  };
  SlipPrinter.prototype.getXmlString = function() {
    return this.message
  };
  SlipPrinter.prototype.cancel = function() {
    var data = {
      type: "slipcancel"
    };
    return this.parent.send(data)
  };
  SlipPrinter.prototype.fireOnReceive = function(res, sq) {
    if (this.onreceive == null) {
      return
    }
    if (res == null) {
      return
    }
    var eventtype = "";
    switch (res.eventtype) {
      case "slipprint":
        eventtype = "send";
        break;
      case "slipcancel":
        eventtype = "cancel";
        break;
      default:
        break
    }
    var code = res.code;
    if (code == "EX_ENPC_TIMEOUT") {
      code = "ERROR_DEVICE_BUSY"
    }
    this.onreceive({
      eventtype: eventtype,
      success: res.success,
      code: code,
      status: res.status
    }, sq)
  };

  function EndorsePrinter(parent) {
    this.parent = parent;
    this.mode40cpl = false;
    this.SUCCESS = "SUCCESS";
    this.CANCEL = "CANCEL";
    this.ERROR_PARAMMETER = "ERROR_PARAMMETER";
    this.ERROR_COMMAND = "ERROR_COMMAND";
    this.ERROR_DEVICE_NOT_FOUND = "ERROR_DEVICE_NOT_FOUND";
    this.ERROR_DEVICE_BUSY = "ERROR_DEVICE_BUSY";
    this.ERROR_NOT_SUPPORTED = "ERROR_NOT_SUPPORTED";
    this.ERROR_COVER_OPEN = "ERROR_COVER_OPEN";
    this.ERROR_TIMEOUT = "ERROR_TIMEOUT";
    this.ERROR_AUTOMATICAL = "ERROR_AUTOMATICAL";
    this.ERROR_UNRECOVERABLE = "ERROR_UNRECOVERABLE";
    this.ERROR_BADPORT = "ERROR_BADPORT";
    this.SYSTEM_ERROR = "SYSTEM_ERROR";
    this.EPTR_CUTTER = "EPTR_CUTTER";
    this.EPTR_MECHANICAL = "EPTR_MECHANICAL";
    this.EPTR_REC_EMPTY = "EPTR_REC_EMPTY";
    this.EPTR_SCHEMAERROR = "EPTR_SCHEMAERROR";
    this.EPTR_PRINT_SYSTEM_ERROR = "EPTR_PRINT_SYSTEM_ERROR"
  }
  EndorsePrinter.prototype = new ePOSBuilder();
  EndorsePrinter.prototype.timeout = 60000;
  EndorsePrinter.prototype.send = function() {
    var xml = (arguments.length < 1) ? this.toString() : arguments[1];
    var data = {
      type: "endorseprint",
      is40cplmode: this.mode40cpl,
      timeout: this.timeout,
      printdata: xml
    };
    var sequence = this.parent.send(data);
    this.setXmlString("");
    return sequence
  };
  EndorsePrinter.prototype.setXmlString = function(xml) {
    this.message = xml
  };
  EndorsePrinter.prototype.getXmlString = function() {
    return this.message
  };
  EndorsePrinter.prototype.cancel = function() {
    var data = {
      type: "endorsecancel"
    };
    return this.parent.send(data)
  };
  EndorsePrinter.prototype.enable40cplmode = function(flag) {
    this.mode40cpl = flag
  };
  EndorsePrinter.prototype.fireOnReceive = function(res, sq) {
    if (this.onreceive == null) {
      return
    }
    if (res == null) {
      return
    }
    var eventtype = "";
    switch (res.eventtype) {
      case "endorseprint":
        eventtype = "send";
        break;
      case "endorsecancel":
        eventtype = "cancel";
        break;
      default:
        break
    }
    var code = res.code;
    if (code == "EX_ENPC_TIMEOUT") {
      code = "ERROR_DEVICE_BUSY"
    }
    this.onreceive({
      eventtype: eventtype,
      success: res.success,
      code: code,
      status: res.status
    }, sq)
  };

  function MICRReader(parent) {
    this.parent = parent;
    this.timeout = 60000;
    this.FONT_E13B = "MICR_E13B";
    this.FONT_CMC7 = "MICR_CMC7";
    this.SUCCESS = "SUCCESS";
    this.CANCEL = "CANCEL";
    this.ERROR_PARAMMETER = "ERROR_PARAMMETER";
    this.ERROR_COMMAND = "ERROR_COMMAND";
    this.ERROR_DEVICE_NOT_FOUND = "ERROR_DEVICE_NOT_FOUND";
    this.ERROR_DEVICE_BUSY = "ERROR_DEVICE_BUSY";
    this.ERROR_NOT_SUPPORTED = "ERROR_NOT_SUPPORTED";
    this.ERROR_COVER_OPEN = "ERROR_COVER_OPEN";
    this.ERROR_TIMEOUT = "ERROR_TIMEOUT";
    this.ERROR_AUTOMATICAL = "ERROR_AUTOMATICAL";
    this.ERROR_UNRECOVERABLE = "ERROR_UNRECOVERABLE";
    this.ERROR_BADPORT = "ERROR_BADPORT";
    this.SYSTEM_ERROR = "SYSTEM_ERROR";
    this.EMICR_ILLEGAL_LENGTH = "EMICR_ILLEGAL_LENGTH";
    this.EMICR_NO_MICR = "EMICR_NO_MICR";
    this.EMICR_RECOGNITION = "EMICR_RECOGNITION";
    this.EMICR_READ = "EMICR_READ";
    this.EMICR_NOISE_DETECTED = "EMICR_NOISE_DETECTED";
    this.EMICR_COVER_OPENED = "EMICR_COVER_OPENED";
    this.EMICR_PAPER_JAM = "EMICR_PAPER_JAM"
  }
  MICRReader.prototype.read = function(ignoreerror, font) {
    var data = {
      type: "micrread",
      ignoreerror: ignoreerror,
      font: font,
      timeout: this.timeout
    };
    return this.parent.send(data)
  };
  MICRReader.prototype.cleaning = function() {
    var data = {
      type: "micrcleaning",
      timeout: this.timeout
    };
    return this.parent.send(data)
  };
  MICRReader.prototype.cancel = function() {
    var data = {
      type: "micrcancel"
    };
    return this.parent.send(data)
  };
  MICRReader.prototype.fireOnReceive = function(res, sq) {
    if (this.onreceive == null) {
      return
    }
    if (res == null) {
      return
    }
    var eventtype = "";
    switch (res.eventtype) {
      case "micrread":
        eventtype = "read";
        break;
      case "micrcleaning":
        eventtype = "cleaning";
        break;
      case "micrcancel":
        eventtype = "cancel";
        break;
      default:
        break
    }
    var code = res.code;
    if (code == "EX_ENPC_TIMEOUT") {
      code = "ERROR_DEVICE_BUSY"
    }
    this.onreceive({
      eventtype: eventtype,
      success: res.success,
      code: code,
      status: res.status,
      data: res.data
    }, sq)
  };

  function HybridPrinter2(deviceID, isCrypto, ePOSDeviceContext) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.ePosDev = ePOSDeviceContext;
    this.connectionObj = null;
    this.ReceiptPrinter = null;
    this.SlipPrinter2 = null;
    this.ValidationPrinter = null;
    this.EndorsePrinter2 = null;
    this.MICRReader2 = null;
    this.currentPrinter = null;
    this.isMicrMode = false;
    this.FONT_A = "font_a";
    this.FONT_B = "font_b";
    this.FONT_C = "font_c";
    this.FONT_D = "font_d";
    this.FONT_E = "font_e";
    this.FONT_SPECIAL_A = "special_a";
    this.FONT_SPECIAL_B = "special_b";
    this.ALIGN_LEFT = "left";
    this.ALIGN_CENTER = "center";
    this.ALIGN_RIGHT = "right";
    this.COLOR_NONE = "none";
    this.COLOR_1 = "color_1";
    this.COLOR_2 = "color_2";
    this.COLOR_3 = "color_3";
    this.COLOR_4 = "color_4";
    this.FEED_PEELING = "peeling";
    this.FEED_CUTTING = "cutting";
    this.FEED_CURRENT_TOF = "current_tof";
    this.FEED_NEXT_TOF = "next_tof";
    this.MODE_MONO = "mono";
    this.MODE_GRAY16 = "gray16";
    this.BARCODE_UPC_A = "upc_a";
    this.BARCODE_UPC_E = "upc_e";
    this.BARCODE_EAN13 = "ean13";
    this.BARCODE_JAN13 = "jan13";
    this.BARCODE_EAN8 = "ean8";
    this.BARCODE_JAN8 = "jan8";
    this.BARCODE_CODE39 = "code39";
    this.BARCODE_ITF = "itf";
    this.BARCODE_CODABAR = "codabar";
    this.BARCODE_CODE93 = "code93";
    this.BARCODE_CODE128 = "code128";
    this.BARCODE_GS1_128 = "gs1_128";
    this.BARCODE_GS1_DATABAR_OMNIDIRECTIONAL = "gs1_databar_omnidirectional";
    this.BARCODE_GS1_DATABAR_TRUNCATED = "gs1_databar_truncated";
    this.BARCODE_GS1_DATABAR_LIMITED = "gs1_databar_limited";
    this.BARCODE_GS1_DATABAR_EXPANDED = "gs1_databar_expanded";
    this.BARCODE_CODE128_AUTO = "code128_auto";
    this.HRI_NONE = "none";
    this.HRI_ABOVE = "above";
    this.HRI_BELOW = "below";
    this.HRI_BOTH = "both";
    this.SYMBOL_PDF417_STANDARD = "pdf417_standard";
    this.SYMBOL_PDF417_TRUNCATED = "pdf417_truncated";
    this.SYMBOL_QRCODE_MODEL_1 = "qrcode_model_1";
    this.SYMBOL_QRCODE_MODEL_2 = "qrcode_model_2";
    this.SYMBOL_QRCODE_MICRO = "qrcode_micro";
    this.SYMBOL_MAXICODE_MODE_2 = "maxicode_mode_2";
    this.SYMBOL_MAXICODE_MODE_3 = "maxicode_mode_3";
    this.SYMBOL_MAXICODE_MODE_4 = "maxicode_mode_4";
    this.SYMBOL_MAXICODE_MODE_5 = "maxicode_mode_5";
    this.SYMBOL_MAXICODE_MODE_6 = "maxicode_mode_6";
    this.SYMBOL_GS1_DATABAR_STACKED = "gs1_databar_stacked";
    this.SYMBOL_GS1_DATABAR_STACKED_OMNIDIRECTIONAL = "gs1_databar_stacked_omnidirectional";
    this.SYMBOL_GS1_DATABAR_EXPANDED_STACKED = "gs1_databar_expanded_stacked";
    this.SYMBOL_AZTECCODE_FULLRANGE = "azteccode_fullrange";
    this.SYMBOL_AZTECCODE_COMPACT = "azteccode_compact";
    this.SYMBOL_DATAMATRIX_SQUARE = "datamatrix_square";
    this.SYMBOL_DATAMATRIX_RECTANGLE_8 = "datamatrix_rectangle_8";
    this.SYMBOL_DATAMATRIX_RECTANGLE_12 = "datamatrix_rectangle_12";
    this.SYMBOL_DATAMATRIX_RECTANGLE_16 = "datamatrix_rectangle_16";
    this.LEVEL_0 = "level_0";
    this.LEVEL_1 = "level_1";
    this.LEVEL_2 = "level_2";
    this.LEVEL_3 = "level_3";
    this.LEVEL_4 = "level_4";
    this.LEVEL_5 = "level_5";
    this.LEVEL_6 = "level_6";
    this.LEVEL_7 = "level_7";
    this.LEVEL_8 = "level_8";
    this.LEVEL_L = "level_l";
    this.LEVEL_M = "level_m";
    this.LEVEL_Q = "level_q";
    this.LEVEL_H = "level_h";
    this.LEVEL_DEFAULT = "default";
    this.LINE_THIN = "thin";
    this.LINE_MEDIUM = "medium";
    this.LINE_THICK = "thick";
    this.LINE_THIN_DOUBLE = "thin_double";
    this.LINE_MEDIUM_DOUBLE = "medium_double";
    this.LINE_THICK_DOUBLE = "thick_double";
    this.DIRECTION_LEFT_TO_RIGHT = "left_to_right";
    this.DIRECTION_BOTTOM_TO_TOP = "bottom_to_top";
    this.DIRECTION_RIGHT_TO_LEFT = "right_to_left";
    this.DIRECTION_TOP_TO_BOTTOM = "top_to_bottom";
    this.CUT_NO_FEED = "no_feed";
    this.CUT_FEED = "feed";
    this.CUT_RESERVE = "reserve";
    this.DRAWER_1 = "drawer_1";
    this.DRAWER_2 = "drawer_2";
    this.PULSE_100 = "pulse_100";
    this.PULSE_200 = "pulse_200";
    this.PULSE_300 = "pulse_300";
    this.PULSE_400 = "pulse_400";
    this.PULSE_500 = "pulse_500";
    this.PATTERN_NONE = "none";
    this.PATTERN_0 = "pattern_0";
    this.PATTERN_1 = "pattern_1";
    this.PATTERN_2 = "pattern_2";
    this.PATTERN_3 = "pattern_3";
    this.PATTERN_4 = "pattern_4";
    this.PATTERN_5 = "pattern_5";
    this.PATTERN_6 = "pattern_6";
    this.PATTERN_7 = "pattern_7";
    this.PATTERN_8 = "pattern_8";
    this.PATTERN_9 = "pattern_9";
    this.PATTERN_10 = "pattern_10";
    this.PATTERN_A = "pattern_a";
    this.PATTERN_B = "pattern_b";
    this.PATTERN_C = "pattern_c";
    this.PATTERN_D = "pattern_d";
    this.PATTERN_E = "pattern_e";
    this.PATTERN_ERROR = "error";
    this.PATTERN_PAPER_END = "paper_end";
    this.LAYOUT_RECEIPT = "receipt";
    this.LAYOUT_RECEIPT_BM = "receipt_bm";
    this.LAYOUT_LABEL = "label";
    this.LAYOUT_LABEL_BM = "label_bm";
    this.HALFTONE_DITHER = 0;
    this.HALFTONE_ERROR_DIFFUSION = 1;
    this.HALFTONE_THRESHOLD = 2;
    this.ASB_NO_RESPONSE = 1;
    this.ASB_PRINT_SUCCESS = 2;
    this.ASB_DRAWER_KICK = 4;
    this.ASB_OFF_LINE = 8;
    this.ASB_COVER_OPEN = 32;
    this.ASB_PAPER_FEED = 64;
    this.ASB_WAIT_ON_LINE = 256;
    this.ASB_PANEL_SWITCH = 512;
    this.ASB_MECHANICAL_ERR = 1024;
    this.ASB_AUTOCUTTER_ERR = 2048;
    this.ASB_UNRECOVER_ERR = 8192;
    this.ASB_AUTORECOVER_ERR = 16384;
    this.ASB_INSERTION_WAIT_PAPER = 65536;
    this.ASB_RECEIPT_NEAR_END = 131072;
    this.ASB_REMOVAL_WAIT_PAPER = 262144;
    this.ASB_RECEIPT_END = 524288;
    this.ASB_TOF_NOPAPER = 2097152;
    this.ASB_BOF_NOPAPER = 4194304;
    this.ASB_SLIP_NO_SELECT = 16777216;
    this.ASB_SLIP_IMPOSSIBLE_PRINT = 33554432;
    this.ASB_EJD_NOPAPER = 1073741824;
    this.ASB_VALIDATION_NO_SELECT = 67108864;
    this.ASB_VALIDATION_IMPOSSIBLE_PRINT = 134217728;
    this.ASB_SPOOLER_IS_STOPPED = 2147483648;
    this.DRAWER_OPEN_LEVEL_LOW = 0;
    this.DRAWER_OPEN_LEVEL_HIGH = 1;
    this.SUCCESS = "SUCCESS";
    this.CANCEL = "CANCEL";
    this.ERROR_CANCEL_FAILED = "ERROR_CANCEL_FAILED";
    this.ERROR_PARAMMETER = "ERROR_PARAMMETER";
    this.ERROR_COMMAND = "ERROR_COMMAND";
    this.ERROR_DEVICE_NOT_FOUND = "ERROR_DEVICE_NOT_FOUND";
    this.ERROR_DEVICE_BUSY = "ERROR_DEVICE_BUSY";
    this.ERROR_NOT_SUPPORTED = "ERROR_NOT_SUPPORTED";
    this.ERROR_COVER_OPEN = "ERROR_COVER_OPEN";
    this.ERROR_TIMEOUT = "ERROR_TIMEOUT";
    this.ERROR_AUTOMATICAL = "ERROR_AUTOMATICAL";
    this.ERROR_UNRECOVERABLE = "ERROR_UNRECOVERABLE";
    this.ERROR_BADPORT = "ERROR_BADPORT";
    this.SYSTEM_ERROR = "SYSTEM_ERROR";
    this.EPTR_AUTOMATICAL = "EPTR_AUTOMATICAL";
    this.EPTR_COVER_OPEN = "EPTR_COVER_OPEN";
    this.EPTR_CUTTER = "EPTR_CUTTER";
    this.EPTR_MECHANICAL = "EPTR_MECHANICAL";
    this.EPTR_REC_EMPTY = "EPTR_REC_EMPTY";
    this.EPTR_UNRECOVERABLE = "EPTR_UNRECOVERABLE";
    this.EPTR_SCHEMAERROR = "EPTR_SCHEMAERROR";
    this.EPTR_PRINT_SYSTEM_ERROR = "EPTR_PRINT_SYSTEM_ERROR";
    this.EPTR_PAPER_PULLED_OUT = "EPTR_PAPER_PULLED_OUT";
    this.EMICR_ILLEGAL_LENGTH = "EMICR_ILLEGAL_LENGTH";
    this.EMICR_NO_MICR = "EMICR_NO_MICR";
    this.EMICR_RECOGNITION = "EMICR_RECOGNITION";
    this.EMICR_READ = "EMICR_READ";
    this.EMICR_NOISE_DETECTED = "EMICR_NOISE_DETECTED";
    this.EMICR_COVER_OPENED = "EMICR_COVER_OPENED";
    this.EMICR_PAPER_JAM = "EMICR_PAPER_JAM";
    this.EMICR_PAPER_PULLED_OUT = "EMICR_PAPER_PULLED_OUT";
    this.DeviceNotFound = "DeviceNotFound";
    this.EX_TIMEOUT = "EX_TIMEOUT";
    this.EX_BADPORT = "EX_BADPORT";
    this.SchemaError = "SchemaError";
    this.PrintSystemError = "PrintSystemError";
    this.PAPERTYPE_RECEIPT = 0;
    this.PAPERTYPE_SLIP = 1;
    this.PAPERTYPE_ENDORSE = 2;
    this.PAPERTYPE_VALIDATION = 3;
    this.FONT_E13B = "MICR_E13B";
    this.FONT_CMC7 = "MICR_CMC7";
    this.halftone = this.HALFTONE_DITHER;
    this.brightness = 1;
    this.force = false;
    this.drawerOpenLevel = this.DRAWER_OPEN_LEVEL_LOW;
    this.paperType = this.PAPERTYPE_RECEIPT;
    this.interval = 3000;
    this.waitTime = 500;
    this.enable40cplMode = true;
    this.onstatuschange = null;
    this.ononline = null;
    this.onoffline = null;
    this.onpoweroff = null;
    this.oncoveropen = null;
    this.onpaperok = null;
    this.onpapernearend = null;
    this.onpaperend = null;
    this.ondrawerclosed = null;
    this.ondraweropen = null;
    this.init(deviceID)
  }
  HybridPrinter2.prototype.init = function(deviceID) {
    this.deviceID = deviceID;
    this.ReceiptPrinter = new ReceiptPrinter(this);
    this.SlipPrinter2 = new SlipPrinter2(this);
    this.ValidationPrinter = new ValidationPrinter(this);
    this.EndorsePrinter2 = new EndorsePrinter2(this);
    this.MICRReader2 = new MICRReader2(this);
    this.currentPrinter = this.ReceiptPrinter;
    this.ReceiptPrinter.onstatuschange = function(status) {
      if (this.parent.onstatuschange != null) {
        this.parent.onstatuschange(status)
      }
    };
    this.ReceiptPrinter.ononline = function() {
      if (this.parent.ononline != null) {
        this.parent.ononline()
      }
    };
    this.ReceiptPrinter.onoffline = function() {
      if (this.parent.onoffline != null) {
        this.parent.onoffline()
      }
    };
    this.ReceiptPrinter.onpoweroff = function() {
      if (this.parent.onpoweroff != null) {
        this.parent.onpoweroff()
      }
    };
    this.ReceiptPrinter.oncoveropen = function() {
      if (this.parent.oncoveropen != null) {
        this.parent.oncoveropen()
      }
    };
    this.ReceiptPrinter.oncoverok = function() {
      if (this.parent.oncoverok != null) {
        this.parent.oncoverok()
      }
    };
    this.ReceiptPrinter.onpaperok = function() {
      if (this.parent.onpaperok != null) {
        this.parent.onpaperok()
      }
    };
    this.ReceiptPrinter.onpapernearend = function() {
      if (this.parent.onpapernearend != null) {
        this.parent.onpapernearend()
      }
    };
    this.ReceiptPrinter.onpaperend = function() {
      if (this.parent.onpaperend != null) {
        this.parent.onpaperend()
      }
    };
    this.ReceiptPrinter.ondrawerclosed = function() {
      if (this.parent.ondrawerclosed != null) {
        this.parent.ondrawerclosed()
      }
    };
    this.ReceiptPrinter.ondraweropen = function() {
      if (this.parent.ondraweropen != undefined) {
        this.parent.ondraweropen()
      }
    };
    this.ReceiptPrinter.onreceive = function(res, sq) {
      this.parent.fireOnReceive(res, sq)
    };
    this.SlipPrinter2.onreceive = function(res, sq) {
      this.parent.fireOnReceive(res, sq)
    };
    this.EndorsePrinter2.onreceive = function(res, sq) {
      this.parent.fireOnReceive(res, sq)
    };
    this.ValidationPrinter.onreceive = function(res, sq) {
      this.parent.fireOnReceive(res, sq)
    };
    this.MICRReader2.onreceive = function(res, sq) {
      this.parent.fireOnReceive(res, sq)
    }
  };
  HybridPrinter2.prototype.setConnectionObject = function(connectionObj) {
    this.connectionObj = connectionObj;
    this.ReceiptPrinter.setConnectionObject(this.connectionObj)
  };
  HybridPrinter2.prototype.isValidFunction = function(paperType, supportPaperTypes) {
    var isValid = false;
    var index = 0;
    if (supportPaperTypes.length != 0) {
      for (index = 0; index < supportPaperTypes.length; index++) {
        if (paperType == supportPaperTypes[index]) {
          isValid = true;
          break
        }
      }
    }
    return isValid
  };
  HybridPrinter2.prototype.addText = function(data) {
    this.currentPrinter.addText.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextLang = function(lang) {
    this.currentPrinter.addTextLang.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextAlign = function(align) {
    this.currentPrinter.addTextAlign.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextRotate = function(rotate) {
    this.currentPrinter.addTextRotate.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextLineSpace = function(linespc) {
    this.currentPrinter.addTextLineSpace.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextFont = function(font) {
    this.currentPrinter.addTextFont.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextSmooth = function(smooth) {
    this.currentPrinter.addTextSmooth.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextDouble = function(dw, dh) {
    this.currentPrinter.addTextDouble.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextSize = function(width, height) {
    this.currentPrinter.addTextSize.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextStyle = function(reverse, ul, em, color) {
    this.currentPrinter.addTextStyle.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextPosition = function(x) {
    this.currentPrinter.addTextPosition.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addTextVPosition = function(y) {
    this.currentPrinter.addTextVPosition.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addFeedUnit = function(unit) {
    this.currentPrinter.addFeedUnit.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addFeedLine = function(line) {
    this.currentPrinter.addFeedLine.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addFeed = function() {
    this.currentPrinter.addFeed.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addFeedPosition = function(pos) {
    this.currentPrinter.addFeedPosition.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addImage = function(context, x, y, width, height, color, mode) {
    this.currentPrinter.halftone = this.halftone;
    this.currentPrinter.brightness = this.brightness;
    this.currentPrinter.addImage.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addLogo = function(key1, key2) {
    this.currentPrinter.addLogo.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addBarcode = function(data, type, hri, font, width, height) {
    this.currentPrinter.addBarcode.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addSymbol = function(data, type, level, width, height, size) {
    this.currentPrinter.addSymbol.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addHLine = function(x1, x2, style) {
    this.currentPrinter.addHLine.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addVLineBegin = function(x, style) {
    this.currentPrinter.addVLineBegin.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addVLineEnd = function(x, style) {
    this.currentPrinter.addVLineEnd.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addPageBegin = function() {
    this.currentPrinter.addPageBegin.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addPageEnd = function() {
    this.currentPrinter.addPageEnd.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addPageArea = function(x, y, width, height) {
    this.currentPrinter.addPageArea.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addPageDirection = function(dir) {
    this.currentPrinter.addPageDirection.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addPagePosition = function(x, y) {
    this.currentPrinter.addPagePosition.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addPageLine = function(x1, y1, x2, y2, style) {
    this.currentPrinter.addPageLine.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addPageRectangle = function(x1, y1, x2, y2, style) {
    this.currentPrinter.addPageRectangle.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addCut = function(type) {
    this.ReceiptPrinter.addCut.apply(this.ReceiptPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addPulse = function(drawer, time) {
    this.currentPrinter.addPulse.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addSound = function(pattern, repeat, cycle) {
    this.currentPrinter.addSound.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addLayout = function(type, width, height, margin_top, margin_bottom, offset_cut, offset_label) {
    this.ReceiptPrinter.addLayout.apply(this.ReceiptPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addRecovery = function() {
    this.ReceiptPrinter.addRecovery.apply(this.ReceiptPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addReset = function() {
    this.ReceiptPrinter.addReset.apply(this.ReceiptPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.addCommand = function(data) {
    this.currentPrinter.addCommand.apply(this.currentPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.recover = function() {
    this.ReceiptPrinter.recover.apply(this.ReceiptPrinter, arguments);
    return this
  };
  HybridPrinter2.prototype.reset = function() {
    this.ReceiptPrinter.force = this.force;
    var ret = this.ReceiptPrinter.reset.apply(this.ReceiptPrinter, arguments);
    this.force = false;
    return ret
  };
  HybridPrinter2.prototype.setMessage = function(message) {
    this.currentPrinter.message = message
  };
  HybridPrinter2.prototype.getMessage = function() {
    return this.currentPrinter.message
  };
  HybridPrinter2.prototype.startMonitor = function() {
    var delay = this.interval;
    if ((typeof(this.interval) != "number") || delay < 1000 || 6000 < delay) {
      delay = 3000
    }
    this.ReceiptPrinter.interval = delay;
    return this.ReceiptPrinter.startMonitor()
  };
  HybridPrinter2.prototype.stopMonitor = function() {
    return this.ReceiptPrinter.stopMonitor()
  };
  HybridPrinter2.prototype.lock = function() {
    var data = {
      type: "lock"
    };
    return this.send(data)
  };
  HybridPrinter2.prototype.unlock = function() {
    var data = {
      type: "unlock"
    };
    return this.send(data)
  };
  HybridPrinter2.prototype.selectPaperType = function(paperType) {
    if (this.isValidFunction(paperType, [this.PAPERTYPE_RECEIPT, this.PAPERTYPE_SLIP, this.PAPERTYPE_ENDORSE, this.PAPERTYPE_VALIDATION]) != true) {
      throw new Error('Property "paperType" is invalid')
    }
    switch (paperType) {
      case this.PAPERTYPE_RECEIPT:
        this.currentPrinter = this.ReceiptPrinter;
        break;
      case this.PAPERTYPE_SLIP:
        this.currentPrinter = this.SlipPrinter2;
        break;
      case this.PAPERTYPE_ENDORSE:
        this.currentPrinter = this.EndorsePrinter2;
        break;
      case this.PAPERTYPE_VALIDATION:
        this.currentPrinter = this.ValidationPrinter;
        break;
      default:
        this.currentPrinter = this.ReceiptPrinter;
        break
    }
    this.paperType = paperType;
    return this
  };
  HybridPrinter2.prototype.waitInsertion = function(timeout) {
    if (this.isValidFunction(this.paperType, [this.PAPERTYPE_SLIP, this.PAPERTYPE_ENDORSE, this.PAPERTYPE_VALIDATION]) != true) {
      throw new Error('Property "paperType" is invalid')
    }
    this.currentPrinter.waitTime = this.waitTime;
    var ret = this.currentPrinter.waitInsertion.apply(this.currentPrinter, arguments);
    return ret
  };
  HybridPrinter2.prototype.cancelInsertion = function() {
    var ret = null;
    if (this.isMicrMode) {
      ret = this.MICRReader2.cancel.apply(this.MICRReader2, arguments)
    } else {
      if (this.isValidFunction(this.paperType, [this.PAPERTYPE_SLIP, this.PAPERTYPE_ENDORSE, this.PAPERTYPE_VALIDATION]) != true) {
        throw new Error('Property "paperType" is invalid')
      }
      ret = this.currentPrinter.cancel.apply(this.currentPrinter, arguments)
    }
    return ret
  };
  HybridPrinter2.prototype.ejectPaper = function() {
    var data = {
      type: "eject"
    };
    return this.send(data)
  };
  HybridPrinter2.prototype.sendData = function(timeout) {
    this.currentPrinter.isCrypto = this.isCrypto;
    if ((typeof(timeout) != "number") || (timeout < 1) || (timeout > 1000000)) {
      this.currentPrinter.timeout = 0
    } else {
      this.currentPrinter.timeout = timeout
    }
    this.EndorsePrinter2.enable40cplmode(this.enable40cplMode);
    this.currentPrinter.force = this.force;
    var ret = this.currentPrinter.send();
    this.force = false;
    return ret
  };
  HybridPrinter2.prototype.print = function(canvas, cut, mode, timeout) {
    if ((typeof(timeout) != "number") || (timeout < 1) || (timeout > 1000000)) {
      this.ReceiptPrinter.timeout = 0
    } else {
      this.ReceiptPrinter.timeout = timeout
    }
    this.ReceiptPrinter.print.apply(this.ReceiptPrinter, [canvas, cut, mode]);
    return this
  };
  HybridPrinter2.prototype.readMicrData = function(ignoreerror, micrFont, timeout) {
    var ignoreerrorMicr = ignoreerror;
    var micrFontMicr = micrFont;
    if (typeof(ignoreerror) == "undefined") {
      ignoreerrorMicr = true
    }
    if (typeof(micrFont) == "undefined") {
      micrFontMicr = this.FONT_E13B
    }
    this.MICRReader2.timeout = timeout;
    this.MICRReader2.waitTime = this.waitTime;
    this.MICRReader2.read.apply(this.MICRReader2, [ignoreerrorMicr, micrFontMicr]);
    this.isMicrMode = true;
    return this
  };
  HybridPrinter2.prototype.cleanMicrReader = function(timeout) {
    this.MICRReader2.timeout = timeout;
    this.MICRReader2.cleaning.apply(this.MICRReader2, []);
    this.isMicrMode = true;
    return this
  };
  HybridPrinter2.prototype.client_onreceive = function(res, sq) {
    switch (res.eventtype) {
      case "slipprint2":
      case "slipcancel":
      case "slipwaitinsertion":
        this.SlipPrinter2.fireOnReceive(res, sq);
        break;
      case "endorseprint2":
      case "endorsecancel":
      case "endorsewaitinsertion":
        this.EndorsePrinter2.fireOnReceive(res, sq);
        break;
      case "validationprint2":
      case "validationcancel":
      case "validationwaitinsertion":
        this.ValidationPrinter.fireOnReceive(res, sq);
        break;
      case "micrread":
      case "micrcleaning":
      case "micrcancel":
        this.MICRReader2.fireOnReceive(res, sq);
        break;
      case "print":
        var tmp = res;
        tmp.eventtype = this.ReceiptPrinter.methodName;
        this.fireOnReceive(tmp, sq);
        break;
      default:
        this.fireOnReceive(res, sq);
        break
    }
  };
  HybridPrinter2.prototype.client_onxmlresult = function(res, sq) {
    this.ReceiptPrinter.fireOnReceive(res, sq)
  };
  HybridPrinter2.prototype.fireOnReceive = function(res, sq) {
    if (typeof(this.onreceive) == undefined) {
      return
    }
    if (res == null) {
      return
    }
    var eventtype = res.eventtype;
    var success = res.success;
    var code = res.code;
    var status = res.status;
    var data = res.data;
    switch (res.eventtype) {
      case "send":
        eventtype = "sendData";
        if (code == this.SUCCESS) {
          this.isMicrMode = false
        }
        break;
      case "waitinsertion":
        eventtype = "waitInsertion";
        if (code == this.SUCCESS) {
          this.isMicrMode = false
        }
        break;
      case "read":
        eventtype = "readMicrData";
        if (code == this.SUCCESS) {
          this.isMicrMode = true
        }
        break;
      case "cleaning":
        eventtype = "cleanMicrReader";
        if (code == this.SUCCESS) {
          this.isMicrMode = true
        }
        break;
      case "cancel":
        eventtype = "cancelInsertion";
        break;
      case "eject":
        eventtype = "ejectPaper";
        if (code == this.SUCCESS) {
          this.isMicrMode = false
        }
        break;
      default:
        break
    }
    switch (code) {
      case "EX_ENPC_TIMEOUT":
        code = "ERROR_DEVICE_BUSY";
        break;
      case "CANCEL":
        this.isMicrMode = false;
        break;
      default:
        break
    }
    this.onreceive({
      method: eventtype,
      success: success,
      code: code,
      status: status,
      data: data
    }, sq)
  };
  HybridPrinter2.prototype.callEvent = function(eventName, data) {
    var eventReq = data;
    eventReq.type = eventName;
    return this.send(eventReq)
  };
  HybridPrinter2.prototype.send = function(data) {
    var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
    var sequence = -1;
    try {
      this.connectionObj.emit(eposmsg);
      sequence = eposmsg.sequence
    } catch (e) {}
    return sequence
  };

  function SlipPrinter2(parent) {
    this.parent = parent
  }
  SlipPrinter2.prototype = new SlipPrinter();
  SlipPrinter2.prototype.timeout = 60000;
  SlipPrinter2.prototype.waitTime = 500;
  SlipPrinter2.prototype.send = function() {
    var xml = null;
    if (arguments.length < 1) {
      xml = this.toString()
    } else {
      xml = arguments[1]
    }
    if ((typeof(this.timeout) != "number") || (this.timeout < 5000) || (this.timeout > 1000000)) {
      this.timeout = 10000
    }
    var data = {
      type: "slipprint2",
      timeout: this.timeout,
      printdata: xml
    };
    var sequence = this.parent.send(data);
    this.setXmlString("");
    return sequence
  };
  SlipPrinter2.prototype.setXmlString = function(xml) {
    this.message = xml
  };
  SlipPrinter2.prototype.getXmlString = function() {
    return this.message
  };
  SlipPrinter2.prototype.waitInsertion = function(timeout) {
    if ((typeof(timeout) != "number") || (timeout < 5000) || (timeout > 900000)) {
      this.timeout = 60000
    } else {
      this.timeout = timeout
    }
    var slipWaitTime = this.waitTime;
    if ((typeof(this.waitTime) != "number") || (this.waitTime < 0) || (this.waitTime > 6400)) {
      slipWaitTime = 500
    }
    var data = {
      type: "slipwaitinsertion",
      timeout: this.timeout,
      waittime: slipWaitTime
    };
    return this.parent.send(data)
  };
  SlipPrinter2.prototype.cancel = function() {
    var data = {
      type: "slipcancel"
    };
    return this.parent.send(data)
  };
  SlipPrinter2.prototype.fireOnReceive = function(res, sq) {
    if (this.onreceive == null) {
      return
    }
    if (res == null) {
      return
    }
    var eventtype = "";
    switch (res.eventtype) {
      case "slipprint2":
        eventtype = "send";
        break;
      case "slipcancel":
        eventtype = "cancel";
        break;
      case "slipwaitinsertion":
        eventtype = "waitinsertion";
        break;
      default:
        break
    }
    this.onreceive({
      eventtype: eventtype,
      success: res.success,
      code: res.code,
      status: res.status
    }, sq)
  };

  function EndorsePrinter2(parent) {
    this.parent = parent;
    this.mode40cpl = false
  }
  EndorsePrinter2.prototype = new EndorsePrinter();
  EndorsePrinter2.prototype.timeout = 60000;
  EndorsePrinter2.prototype.waitTime = 500;
  EndorsePrinter2.prototype.send = function() {
    var xml = null;
    if (arguments.length < 1) {
      xml = this.toString()
    } else {
      xml = arguments[1]
    }
    if ((typeof(this.timeout) != "number") || (this.timeout < 60000) || (this.timeout > 900000)) {
      this.timeout = 60000
    }
    var data = {
      type: "endorseprint2",
      is40cplmode: this.mode40cpl,
      timeout: this.timeout,
      printdata: xml
    };
    var sequence = this.parent.send(data);
    this.setXmlString("");
    return sequence
  };
  EndorsePrinter2.prototype.setXmlString = function(xml) {
    this.message = xml
  };
  EndorsePrinter2.prototype.getXmlString = function() {
    return this.message
  };
  EndorsePrinter2.prototype.waitInsertion = function(timeout) {
    if ((typeof(timeout) != "number") || (timeout < 5000) || (timeout > 900000)) {
      this.timeout = 60000
    } else {
      this.timeout = timeout
    }
    var endorseWaitTime = this.waitTime;
    if ((typeof(this.waitTime) != "number") || (this.waitTime < 0) || (this.waitTime > 6400)) {
      endorseWaitTime = 500
    }
    var data = {
      type: "endorsewaitinsertion",
      timeout: this.timeout,
      waittime: endorseWaitTime
    };
    return this.parent.send(data)
  };
  EndorsePrinter2.prototype.cancel = function() {
    var data = {
      type: "endorsecancel"
    };
    return this.parent.send(data)
  };
  EndorsePrinter2.prototype.enable40cplmode = function(flag) {
    this.mode40cpl = flag
  };
  EndorsePrinter2.prototype.fireOnReceive = function(res, sq) {
    if (this.onreceive == null) {
      return
    }
    if (res == null) {
      return
    }
    var eventtype = "";
    switch (res.eventtype) {
      case "endorseprint2":
        eventtype = "send";
        break;
      case "endorsecancel":
        eventtype = "cancel";
        break;
      case "endorsewaitinsertion":
        eventtype = "waitinsertion";
        break;
      default:
        break
    }
    this.onreceive({
      eventtype: eventtype,
      success: res.success,
      code: res.code,
      status: res.status
    }, sq)
  };

  function MICRReader2(parent) {
    this.parent = parent
  }
  MICRReader2.prototype = new MICRReader();
  MICRReader2.prototype.waitTime = 500;
  MICRReader2.prototype.read = function(ignoreerror, font) {
    if ((typeof(this.timeout) != "number") || (this.timeout < 5000) || (this.timeout > 900000)) {
      this.timeout = 60000
    }
    var micrWaitTime = this.waitTime;
    if ((typeof(this.waitTime) != "number") || (this.waitTime < 0) || (this.waitTime > 6400)) {
      micrWaitTime = 500
    }
    var data = {
      type: "micrread",
      ignoreerror: ignoreerror,
      font: font,
      timeout: this.timeout,
      waittime: micrWaitTime
    };
    return this.parent.send(data)
  };
  MICRReader2.prototype.cleaning = function() {
    var micrWaitTime = this.waitTime;
    this.timeout = 60000;
    if ((typeof(this.waitTime) != "number") || (this.waitTime < 0) || (this.waitTime > 6400)) {
      micrWaitTime = 500
    }
    var data = {
      type: "micrcleaning",
      timeout: this.timeout,
      waittime: micrWaitTime
    };
    return this.parent.send(data)
  };

  function ValidationPrinter(parent) {
    this.parent = parent
  }
  ValidationPrinter.prototype = new ePOSBuilder();
  ValidationPrinter.prototype.timeout = 10000;
  ValidationPrinter.prototype.waitTime = 500;
  ValidationPrinter.prototype.send = function() {
    var xml = null;
    if (arguments.length < 1) {
      xml = this.toString()
    } else {
      xml = arguments[1]
    }
    if ((typeof(this.timeout) != "number") || (this.timeout < 5000) || (this.timeout > 1000000)) {
      this.timeout = 10000
    }
    var data = {
      type: "validationprint2",
      timeout: this.timeout,
      printdata: xml
    };
    var sequence = this.parent.send(data);
    this.setXmlString("");
    return sequence
  };
  ValidationPrinter.prototype.setXmlString = function(xml) {
    this.message = xml
  };
  ValidationPrinter.prototype.getXmlString = function() {
    return this.message
  };
  ValidationPrinter.prototype.waitInsertion = function(timeout) {
    if ((typeof(timeout) != "number") || (timeout < 5000) || (timeout > 900000)) {
      this.timeout = 60000
    } else {
      this.timeout = timeout
    }
    var validationWaitTime = this.waitTime;
    if ((typeof(this.waitTime) != "number") || (this.waitTime < 0) || (this.waitTime > 6400)) {
      validationWaitTime = 500
    }
    var data = {
      type: "validationwaitinsertion",
      timeout: this.timeout,
      waittime: validationWaitTime
    };
    return this.parent.send(data)
  };
  ValidationPrinter.prototype.cancel = function() {
    var data = {
      type: "validationcancel"
    };
    return this.parent.send(data)
  };
  ValidationPrinter.prototype.fireOnReceive = function(res, sq) {
    if (this.onreceive == null) {
      return
    }
    if (res == null) {
      return
    }
    var eventtype = "";
    switch (res.eventtype) {
      case "validationprint2":
        eventtype = "send";
        break;
      case "validationcancel":
        eventtype = "cancel";
        break;
      case "validationwaitinsertion":
        eventtype = "waitinsertion";
        break;
      default:
        break
    }
    this.onreceive({
      eventtype: eventtype,
      success: res.success,
      code: res.code,
      status: res.status
    }, sq)
  };

  function Scanner(deviceID, isCrypto) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connectionObj = null
  }
  Scanner.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    client_ondata: function(data) {
      try {
        if (this.ondata == null) {
          return
        }
        this.ondata(data)
      } catch (e) {}
      return
    },
    client_onbinarydata: function(data) {
      try {
        if (this.onbinarydata == null) {
          return
        }
        this.onbinarydata(data)
      } catch (e) {}
      return
    },
    client_setbinarymode: function(data) {
      try {
        if (this.onbinarymode == null) {
          return
        }
        this.onbinarymode(data)
      } catch (e) {}
      return
    },
    setBinaryMode: function(enable) {
      var str = "";
      if (enable == true) {
        str = "true"
      } else {
        str = "false"
      }
      var data = {
        type: "setbinarymode",
        binarymode: str
      };
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    },
    callEvent: function(eventName, data) {
      var eventReq = data;
      eventReq.type = eventName;
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, eventReq, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    }
  };

  function SimpleSerial(deviceID, isCrypto) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connectionObj = null
  }
  SimpleSerial.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    sendCommand: function(command) {
      var data = {
        type: "sendcommand",
        command: toHexBinary(command)
      };
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    },
    client_oncommandreply: function(data) {
      try {
        if (this.oncommandreply == null) {
          return
        }
        var hexData = data.data;
        hexData = hexData.replace(/[0-9a-fA-F]{2}/g, function(c) {
          var hexNum = parseInt(c, 16);
          return String.fromCharCode(hexNum)
        });
        data.data = hexData;
        this.oncommandreply(data)
      } catch (e) {}
      return
    }
  };

  function GermanyFiscalElement(deviceID, isCrypto) {
    this.deviceID = deviceID;
    this.isCrypto = isCrypto;
    this.connectionObj = null;
    this.ongfereceive = null;
    this.onerror = null
  }
  GermanyFiscalElement.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    operate: function(jsonString, timeout) {
      var data = {
        type: "operate",
        timeout: timeout,
        requestdata: jsonString
      };
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {
        throw e
      }
      return sequence
    },
    client_operateresult: function(data) {
      if (this.ongfereceive == null) {
        return
      }
      if (data.resultformat == "Base64-encoded") {
        try {
          data.resultdata = window.atob(data.resultdata);
          var uint8array = new Uint8Array(data.resultdata.length);
          for (var i = 0; i < data.resultdata.length; i++) {
            uint8array[i] = data.resultdata.charCodeAt(i)
          }
          var inflate = new Zlib.Inflate(uint8array);
          var charData = inflate.decompress();
          data.resultdata = [];
          for (var j = 0; j < charData.length; j++) {
            data.resultdata = data.resultdata + String.fromCharCode(charData[j])
          }
        } catch (e) {
          if (this.onerror) {
            this.onerror(e)
          }
          return
        }
      }
      try {
        this.ongfereceive(this.getResultObject(data))
      } catch (e) {
        if (this.onerror) {
          this.onerror(e)
        }
      }
      return
    },
    getResultObject: function(data) {
      return ({
        success: data.success,
        code: data.code,
        resultdata: data.resultdata,
      })
    },
    callEvent: function(eventName, data) {
      var eventReq = {
        type: eventName,
        data: data
      };
      var eposmsg = MessageFactory.getDeviceDataMessage(this.deviceID, data, this.isCrypto);
      var sequence = -1;
      try {
        this.connectionObj.emit(eposmsg);
        sequence = eposmsg.sequence
      } catch (e) {}
      return sequence
    }
  };

  function Ofsc() {
    this.SERVICE_ID = "OFSC";
    this.callback = null;
    this.connectionObj = null
  }
  Ofsc.prototype = {
    setConnectionObject: function(connectionObj) {
      this.connectionObj = connectionObj
    },
    send: function(xml, timeout, crypto, callback) {
      this.callback = callback;
      try {
        if (this.connectionObj.isUsableDeviceIF()) {
          var data = {
            type: "print",
            timeout: timeout,
            printdata: xml
          };
          var eposmsg = MessageFactory.getServiceMessage(this.SERVICE_ID, crypto, data);
          this.connectionObj.emit(eposmsg)
        }
      } catch (e) {
        return
      }
    },
    notify: function(eposmsg) {
      var data = null;
      if (eposmsg.isCrypto == "1") {
        data = MessageFactory.decrypt(eposmsg.data)
      } else {
        data = eposmsg.data
      }
      if (this.callback != null) {
        this.callback(data.resultdata)
      }
    },
    onxmlresult: function(xml) {
      if (this.callback != null) {
        this.callback(xml)
      }
    }
  };

  function CookieIO() {
    this.TAG = "EPSON_EPOSDEVICE_CLIENTID";
    this.EXPIRES_MINUTES = 5
  }
  CookieIO.prototype = {
    writeId: function(value, address) {
      if (address == "") {
        return
      }
      var encodedAddress = encodeURIComponent(address);
      var encodedTitle = encodeURIComponent(document.title);
      var hostname = location.hostname;
      var expired = this.getExpiredDate();
      document.cookie = this.TAG + "_" + hostname + "_" + encodedAddress + "_" + encodedTitle + "=" + encodeURIComponent(value) + "; expires=" + expired
    },
    readId: function(address) {
      var id = "";
      var strCookie = document.cookie + ";";
      var encodedAddress = encodeURIComponent(address);
      var encodedTitle = encodeURIComponent(document.title);
      var hostname = location.hostname;
      var searchKey = this.TAG + "_" + hostname + "_" + encodedAddress + "_" + encodedTitle + "=";
      var keyValueFrom = strCookie.indexOf(searchKey);
      if (keyValueFrom != -1) {
        keyValueFrom += searchKey.length;
        var keyValueTo = strCookie.indexOf(";", keyValueFrom);
        id = decodeURIComponent(strCookie.substring(keyValueFrom, keyValueTo))
      }
      return id
    },
    getExpiredDate: function() {
      var expire = new Date();
      var nTime = expire.getTime();
      expire.setTime(nTime + (1000 * 60 * this.EXPIRES_MINUTES));
      return expire.toUTCString()
    }
  };

  function DeviceObjElement(deviceId, isCrypto, deviceObject, callback) {
    this.deviceId = deviceId;
    this.isCrypto = isCrypto;
    this.deviceObject = deviceObject;
    this.callback = callback
  }

  function DeviceObjElementMap() {
    this.elementList = new Array()
  }
  DeviceObjElementMap.prototype = {
    add: function(element) {
      this.elementList.push(element)
    },
    get: function(deviceId) {
      var element = null;
      for (var i = 0; i < this.elementList.length; i++) {
        if (this.elementList[i].deviceId == deviceId) {
          element = this.elementList[i];
          break
        }
      }
      return element
    },
    getByObj: function(deviceObject) {
      var element = null;
      for (var i = 0; i < this.elementList.length; i++) {
        if (this.elementList[i].deviceObject == deviceObject) {
          element = this.elementList[i];
          break
        }
      }
      return element
    },
    remove: function(deviceId) {
      for (var i = 0; i < this.elementList.length; i++) {
        if (this.elementList[i].deviceId == deviceId) {
          this.elementList.splice(i, 1);
          break
        }
      }
    },
    removeAll: function() {
      this.elementList = []
    },
    getElementList: function() {
      return this.elementList
    },
  };

  function ePOSDevice() {
    this.DEVICE_TYPE_SCANNER = "type_scanner";
    this.DEVICE_TYPE_KEYBOARD = "type_keyboard";
    this.DEVICE_TYPE_POSKEYBOARD = "type_poskeyboard";
    this.DEVICE_TYPE_MSR = "type_msr";
    this.DEVICE_TYPE_CAT = "type_cat";
    this.DEVICE_TYPE_CASH_CHANGER = "type_cash_changer";
    this.DEVICE_TYPE_PRINTER = "type_printer";
    this.DEVICE_TYPE_DISPLAY = "type_display";
    this.DEVICE_TYPE_SIMPLE_SERIAL = "type_simple_serial";
    this.DEVICE_TYPE_HYBRID_PRINTER = "type_hybrid_printer";
    this.DEVICE_TYPE_HYBRID_PRINTER2 = "type_hybrid_printer2";
    this.DEVICE_TYPE_DT = "type_dt";
    this.DEVICE_TYPE_OTHER_PERIPHERAL = "type_other_peripheral";
    this.DEVICE_TYPE_GFE = "type_storage";
    this.RESULT_OK = "OK";
    this.ERROR_SYSTEM = "SYSTEM_ERROR";
    this.ERROR_DEVICE_IN_USE = "DEVICE_IN_USE";
    this.ERROR_DEVICE_OPEN = "DEVICE_OPEN_ERROR";
    this.ERROR_DEVICE_CLOSE = "DEVICE_CLOSE_ERROR";
    this.ERROR_DEVICE_NOT_OPEN = "DEVICE_NOT_OPEN";
    this.ERROR_DEVICE_NOT_FOUND = "DEVICE_NOT_FOUND";
    this.ERROR_PARAMETER = "ERROR_PARAMETER";
    this.IFPORT_EPOSDEVICE = 8008;
    this.IFPORT_EPOSDEVICE_S = 8043;
    this.CONNECT_TIMEOUT = 15000;
    this.RECONNECT_TIMEOUT = 3000;
    this.MAX_RECONNECT_RETRY = 5;
    this.socket = null;
    this.connectionId = null;
    this.reconnectTimerId = null;
    this.reconnectTryCount = 0;
    this.admin = "";
    this.location = "";
    this.recievedDataId = 0;
    this.connectStartTime = 0;
    this.waitRetryConnectId = 0;
    this.conectionObj = new Connection();
    this.commBoxManager = new CommBoxManager();
    this.commBoxManager.setConnectionObject(this.conectionObj);
    this.devObjSelector = new DeviceObjectSelector();
    this.devObjSelector.setConnectionObject(this.conectionObj);
    this.devObjElmMap = new DeviceObjElementMap();
    this.ofsc = new Ofsc();
    this.ofsc.setConnectionObject(this.conectionObj);
    this.cookieIo = new CookieIO();
    this.gbox = new SocketGarbageBox();
    this.eposprint = false;
    this.cbCheckEposPrintService = null;
    var self = this;
    window.onbeforeunload = function() {
      self.disconnect()
    };
    window.onpagehide = function() {
      self.disconnect()
    }
  }
  ePOSDevice.prototype = {
    connect: function(address, port, callback, options) {
      if ((this.conectionObj.status(this.conectionObj.IF_EPOSDEVICE) != this.conectionObj.DISCONNECT) || (this.conectionObj.status(this.conectionObj.IF_EPOSPRINT) != this.conectionObj.DISCONNECT)) {
        this.disconnect()
      }
      this.connectStartTime = new Date().getTime();
      var protocol = (port == this.IFPORT_EPOSDEVICE) ? "http" : "https";
      this.conectionObj.setAddress(protocol, address, port);
      this.conectionObj.registCallback(callback);
      if (arguments.length >= 4) {
        this.eposprint = options.eposprint
      } else {
        this.eposprint = false
      }
      var self = this;
      if (this.eposprint) {
        var selfofProb = this.conectionObj;
        this.conectionObj.probeWebServiceIF(function(accessTime) {
          var result = self.ERROR_PARAMETER;
          if (selfofProb.isUsablePrintIF()) {
            result = self.RESULT_OK
          }
          callback(result)
        })
      } else {
        this.connectBySocketIo(this.CONNECT_TIMEOUT)
      }
    },
    isConnected: function() {
      var devIsConnect = false;
      var wsIsConnect = false;
      switch (this.conectionObj.status(this.conectionObj.IF_EPOSDEVICE)) {
        case this.conectionObj.CONNECT:
        case this.conectionObj.RECONNECTING:
          devIsConnect = true;
          break;
        case this.conectionObj.DISCONNECT:
          break
      }
      if (this.conectionObj.status(this.conectionObj.IF_EPOSPRINT) == this.conectionObj.CONNECT) {
        wsIsConnect = true
      }
      return devIsConnect | wsIsConnect
    },
    disconnect: function() {
      var eposmsg = MessageFactory.getDisconnectMessage(this.connectionId);
      this.conectionObj.emit(eposmsg);
      this.cleanup()
    },
    createDevice: function(deviceId, deviceType, options, callback) {
      try {
        if (!this.isConnected()) {
          throw new Error(this.ERROR_SYSTEM)
        }
        if (this.devObjElmMap.get(deviceId) != null) {
          throw new Error(this.ERROR_DEVICE_IN_USE)
        }
        if (!this.devObjSelector.isSelectable(deviceType)) {
          throw new Error(this.ERROR_DEVICE_NOT_FOUND)
        }
        var isCrypto = false;
        var isBufferEnable = false;
        if (typeof(options) == "boolean") {
          isCrypto = options
        } else {
          if (typeof(options.crypto) == "boolean") {
            isCrypto = options.crypto
          }
          if (typeof(options.buffer) == "boolean") {
            isBufferEnable = options.buffer
          }
        }
        if (deviceType == this.DEVICE_TYPE_DT) {
          isCrypto = true;
          deviceId = "local_dt"
        }
        var deviceObject = this.devObjSelector.select(deviceId, deviceType, options.driver, isCrypto, this);
        deviceObject.setConnectionObject(this.conectionObj);
        var element = new DeviceObjElement(deviceId, isCrypto, deviceObject, callback);
        this.devObjElmMap.add(element);
        if (this.conectionObj.isUsableDeviceIF()) {
          var eposmsg = MessageFactory.getOpenDeviceMessage(deviceId, deviceType, isCrypto, isBufferEnable);
          this.conectionObj.emit(eposmsg)
        } else {
          var self = this;
          this.checkEposPrintService(deviceId, deviceType, function(result) {
            if (result == self.RESULT_OK) {
              callback(deviceObject, self.RESULT_OK)
            } else {
              callback(null, self.ERROR_DEVICE_NOT_FOUND)
            }
          })
        }
      } catch (e) {
        var message = e.message;
        if ((message == null) || (message == "")) {
          message = this.ERROR_DEVICE_OPEN
        }
        if (callback != null) {
          callback(null, message)
        }
      }
    },
    deleteDevice: function(deviceObject, callback) {
      try {
        var element = this.devObjElmMap.getByObj(deviceObject);
        if (element == null) {
          throw new Error(this.ERROR_DEVICE_NOT_OPEN)
        }
        if (this.conectionObj.isUsableDeviceIF()) {
          element.callback = callback;
          var eposmsg = MessageFactory.getCloseDeviceMessage(element.deviceId);
          this.conectionObj.emit(eposmsg)
        } else {
          try {
            deviceObject.finalize()
          } catch (e) {}
          this.devObjElmMap.remove(element.deviceId);
          callback(this.RESULT_OK)
        }
      } catch (e) {
        var message = e.message;
        if ((message == null) || (message == "")) {
          message = this.ERROR_DEVICE_CLOSE
        }
        if (callback != null) {
          callback(message)
        }
      }
    },
    getAdmin: function() {
      return this.admin
    },
    getLocation: function() {
      return this.location
    },
    sendOfscXml: function(xml, timeout, crypto, callback) {
      this.ofsc.send(xml, timeout, crypto, callback)
    },
    getCommBoxManager: function() {
      if (this.conectionObj.status(this.conectionObj.IF_EPOSDEVICE) != this.conectionObj.CONNECT) {
        return null
      }
      return this.commBoxManager
    },
    cleanup: function() {
      if (this.waitRetryConnectId != 0) {
        clearTimeout(this.waitRetryConnectId);
        this.waitRetryConnectId = 0
      }
      this.connectStartTime = 0;
      this.gbox.stock(this.socket);
      this.gbox.dispose();
      var devObjList = this.devObjElmMap.getElementList();
      devObjList.forEach(function(obj) {
        try {
          obj.deviceObject.finalize()
        } catch (e) {}
      });
      devObjList = null;
      this.devObjElmMap.removeAll();
      if ((this.ondisconnect != null) && (this.conectionObj.status(this.conectionObj.IF_EPOSDEVICE) != this.conectionObj.DISCONNECT || this.conectionObj.status(this.conectionObj.IF_EPOSPRINT) != this.conectionObj.DISCONNECT)) {
        this.ondisconnect()
      }
      this.cookieIo.writeId("", this.conectionObj.address_p);
      this.conectionObj.changeStatus(this.conectionObj.IF_ALL, this.conectionObj.DISCONNECT);
      this.socket = null;
      this.conectionObj.setSocket(null);
      this.connectionId = null;
      this.conectionObj.setAddress("", "", "");
      if (this.reconnectTimerId != null) {
        clearInterval(this.reconnectTimerId)
      }
      this.reconnectTimerId = null;
      this.reconnectTryCount = 0;
      this.admin = "";
      this.location = "";
      this.recievedDataId = 0;
      this.eposprint = false
    },
    connectBySocketIo: function(timeout) {
      var selfofProb = this.conectionObj;
      var url = selfofProb.getSocketIoURL();
      this.socket = io.connect(url, {
        reconnect: false,
        "connect timeout": timeout,
        "force new connection": true
      });
      this.conectionObj.setSocket(this.socket);
      var self = this;
      this.socket.on("connect", function(data) {
        try {
          self.gbox.dispose()
        } catch (e) {}
      });
      this.socket.on("close", function() {
        selfofProb.changeStatus(selfofProb.IF_EPOSDEVICE, tselfofProb.DISCONNECT)
      });
      this.socket.on("disconnect", function(data) {
        try {
          if (selfofProb.status(selfofProb.IF_EPOSDEVICE) == selfofProb.RECONNECTING) {
            return
          } else {
            if (self.cookieIo.readId(self.conectionObj.address_p) == "" && self.connectionId == null) {
              self.cleanup()
            } else {
              self.startReconnectAction()
            }
          }
        } catch (e) {}
      });
      this.socket.on("error", function() {
        try {
          selfofProb.probeWebServiceIF(function(accessTime) {
            if (selfofProb.isUsablePrintIF()) {
              self.eposprint = true;
              selfofProb.registIFAccessResult(selfofProb.IF_EPOSDEVICE, selfofProb.ACCESS_NONE)
            } else {
              selfofProb.changeStatus(selfofProb.IF_EPOSDEVICE, selfofProb.DISCONNECT);
              selfofProb.registIFAccessResult(selfofProb.IF_EPOSDEVICE, selfofProb.ACCESS_TIMEOUT)
            }
          })
        } catch (e) {}
      });
      this.socket.on("connect_failed", function() {
        try {
          selfofProb.probeWebServiceIF(function(accessTime) {
            if (selfofProb.isUsablePrintIF()) {
              self.eposprint = true;
              selfofProb.registIFAccessResult(selfofProb.IF_EPOSDEVICE, selfofProb.ACCESS_NONE)
            } else {
              selfofProb.changeStatus(selfofProb.IF_EPOSDEVICE, selfofProb.DISCONNECT);
              selfofProb.registIFAccessResult(selfofProb.IF_EPOSDEVICE, selfofProb.ACCESS_TIMEOUT)
            }
          })
        } catch (e) {}
      });
      this.socket.on("message", function(data) {
        try {
          var eposmsg = MessageFactory.parseRequestMessage(data);
          if (eposmsg.data_id != "") {
            self.recievedDataId = eposmsg.data_id
          }
          switch (eposmsg.request) {
            case eposmsg.REQUEST.CONNECT:
              self.procConnect(eposmsg);
              break;
            case eposmsg.REQUEST.PUBKEY:
              self.procPubkey(eposmsg);
              break;
            case eposmsg.REQUEST.ADMININFO:
              self.procAdminInfo(eposmsg);
              break;
            case eposmsg.REQUEST.RECONNECT:
              self.procReconnect(eposmsg);
              break;
            case eposmsg.REQUEST.DISCONNECT:
              self.procDisconnect(eposmsg);
              break;
            case eposmsg.REQUEST.OPENDEVICE:
              self.procOpenDevice(eposmsg);
              break;
            case eposmsg.REQUEST.CLOSEDEVICE:
              self.procCloseDevice(eposmsg);
              break;
            case eposmsg.REQUEST.DEVICEDATA:
              self.procDeviceData(eposmsg);
              break;
            case eposmsg.REQUEST.SERVICEDATA:
              self.procServiceData(eposmsg);
              break;
            case eposmsg.REQUEST.OPENCOMMBOX:
              self.procOpenCommBox(eposmsg);
              break;
            case eposmsg.REQUEST.CLOSECOMMBOX:
              self.procCloseCommBox(eposmsg);
              break;
            case eposmsg.REQUEST.COMMDATA:
              self.procCommBoxData(eposmsg);
              break;
            case eposmsg.REQUEST.ERROR:
              self.procError(eposmsg);
              break;
            default:
              return
          }
        } catch (e) {}
      })
    },
    procConnect: function(eposmsg) {
      try {
        if (this.reconnectTimerId != null) {
          clearInterval(this.reconnectTimerId);
          this.reconnectTimerId = null
        }
        var response = null;
        var prevConnectionId = this.cookieIo.readId(this.conectionObj.address_p);
        if (eposmsg.data.protocol_version < 2) {
          response = MessageFactory.getPubkeyMessage(eposmsg.data.prime, eposmsg.data.key);
          this.conectionObj.emit(response)
        } else {
          if (this.connectionId != null) {
            response = MessageFactory.getReconnectMessage(this.connectionId, eposmsg.data.client_id, this.recievedDataId);
            this.conectionObj.emit(response)
          } else {
            if (prevConnectionId != "") {
              response = MessageFactory.getDisconnectMessage(prevConnectionId);
              this.conectionObj.emit(response);
              response = MessageFactory.getPubkeyMessage(eposmsg.data.prime, eposmsg.data.key);
              this.conectionObj.emit(response)
            } else {
              response = MessageFactory.getPubkeyMessage(eposmsg.data.prime, eposmsg.data.key);
              this.conectionObj.emit(response)
            }
          }
        }
        this.cookieIo.writeId(eposmsg.data.client_id, this.conectionObj.address_p);
        this.connectionId = eposmsg.data.client_id
      } catch (e) {
        this.conectionObj.registIFAccessResult(this.conectionObj.IF_EPOSDEVICE, this.conectionObj.ACCESS_ERROR);
        this.cleanup()
      }
    },
    procPubkey: function(eposmsg) {
      try {
        if (eposmsg.code == "SHARED_KEY_MISMATCH_ERROR") {
          var mismatchErrTime = new Date().getTime();
          var mismatchTimeout = 0;
          if (this.connectStartTime != 0) {
            mismatchTimeout = mismatchErrTime - this.connectStartTime;
            if (mismatchTimeout < this.CONNECT_TIMEOUT) {
              var self = this;
              this.gbox.stock(this.socket);
              this.connectionId = null;
              this.waitRetryConnectId = setTimeout(function() {
                self.connectBySocketIo(self.CONNECT_TIMEOUT - mismatchTimeout)
              }, 100)
            } else {
              this.conectionObj.registIFAccessResult(this.conectionObj.IF_EPOSDEVICE, this.conectionObj.ACCESS_TIMEOUT);
              this.cleanup()
            }
          } else {
            this.conectionObj.registIFAccessResult(this.conectionObj.IF_EPOSDEVICE, this.conectionObj.ACCESS_TIMEOUT);
            this.cleanup()
          }
        } else {
          if (eposmsg.code == "PARAM_ERROR") {
            this.conectionObj.registIFAccessResult(this.conectionObj.IF_EPOSDEVICE, this.conectionObj.ACCESS_ERROR);
            this.cleanup()
          } else {
            var response = MessageFactory.getAdminInfoMessage();
            this.conectionObj.emit(response)
          }
        }
      } catch (e) {
        this.conectionObj.registIFAccessResult(this.conectionObj.IF_EPOSDEVICE, this.conectionObj.ACCESS_ERROR);
        this.cleanup()
      }
    },
    procAdminInfo: function(eposmsg) {
      if (this.eposprint) {
        return
      }
      if (eposmsg.code != this.RESULT_OK) {
        this.conectionObj.registIFAccessResult(this.conectionObj.IF_EPOSDEVICE, this.conectionObj.ACCESS_ERROR);
        return
      }
      this.admin = eposmsg.data.admin_name;
      this.location = eposmsg.data.location;
      this.conectionObj.registIFAccessResult(this.conectionObj.IF_EPOSDEVICE, this.conectionObj.ACCESS_OK)
    },
    procReconnect: function(eposmsg) {
      if (this.conectionObj.status(this.conectionObj.IF_EPOSDEVICE) != this.conectionObj.RECONNECTING) {
        return
      }
      if (eposmsg.code == this.RESULT_OK) {
        this.conectionObj.changeStatus(this.conectionObj.IF_EPOSDEVICE, this.conectionObj.CONNECT);
        if (this.onreconnect != null) {
          this.onreconnect()
        }
      } else {
        this.cleanup()
      }
    },
    procDisconnect: function(eposmsg) {},
    procOpenDevice: function(eposmsg) {
      var deviceId = eposmsg.deviceId;
      try {
        var element = this.devObjElmMap.get(deviceId);
        if (eposmsg.code == this.RESULT_OK) {
          if (element.callback != null) {
            element.callback(element.deviceObject, eposmsg.code)
          }
        } else {
          if (element.callback != null) {
            element.callback(null, eposmsg.code)
          }
          this.devObjElmMap.remove(deviceId)
        }
      } catch (e) {
        if (this.onerror != null) {
          this.onerror("0", deviceId, this.ERROR_SYSTEM, null)
        }
      }
    },
    procCloseDevice: function(eposmsg) {
      var deviceId = eposmsg.deviceId;
      try {
        if (eposmsg.code == this.RESULT_OK) {
          var element = this.devObjElmMap.get(deviceId);
          if (element.callback != null) {
            element.callback(eposmsg.code)
          }
          try {
            element.deviceObject.finalize()
          } catch (e) {}
          this.devObjElmMap.remove(deviceId)
        }
      } catch (e) {
        if (this.onerror != null) {
          this.onerror("0", deviceId, this.ERROR_SYSTEM, null)
        }
      }
    },
    procDeviceData: function(eposmsg) {
      var deviceId = eposmsg.deviceId;
      var sequence = eposmsg.sequence;
      var data = eposmsg.data;
      try {
        var devObjElm = this.devObjElmMap.get(deviceId);
        if (devObjElm.isCrypto) {
          data = MessageFactory.decrypt(data)
        }
        var deviceObject = devObjElm.deviceObject;
        var method = "client_" + data.type;
        try {
          if (deviceObject instanceof OtherPeripheral) {
            deviceObject.client_onreceive(data, sequence)
          } else {
            eval("deviceObject." + method + "(data, sequence)")
          }
        } catch (e) {
          eval("deviceObject." + data.type + "(data, sequence)")
        }
      } catch (e) {
        if (this.onerror != null) {
          this.onerror(sequence, deviceId, this.ERROR_SYSTEM, null)
        }
      }
    },
    procServiceData: function(eposmsg) {
      try {
        switch (eposmsg.serviceId) {
          case "OFSC":
            this.ofsc.notify(eposmsg);
            break;
          default:
            break
        }
      } catch (e) {
        if (this.onerror != null) {
          this.onerror(eposmsg.sequence, eposmsg.serviceId, this.ERROR_SYSTEM, null)
        }
      }
    },
    procOpenCommBox: function(eposmsg) {
      var sequence = eposmsg.sequence;
      try {
        this.commBoxManager.client_opencommbox(eposmsg.data, sequence)
      } catch (e) {
        if (this.onerror != null) {
          this.onerror(sequence, "", this.ERROR_SYSTEM, null)
        }
      }
    },
    procCloseCommBox: function(eposmsg) {
      var sequence = eposmsg.sequence;
      try {
        this.commBoxManager.client_closecommbox(eposmsg.data, sequence)
      } catch (e) {
        if (this.onerror != null) {
          this.onerror(sequence, "", this.ERROR_SYSTEM, null)
        }
      }
    },
    procCommBoxData: function(eposmsg) {
      var sequence = eposmsg.sequence;
      try {
        this.commBoxManager.executeCommDataCallback(eposmsg.data, sequence)
      } catch (e) {
        if (this.onerror != null) {
          this.onerror(sequence, "", this.ERROR_SYSTEM, null)
        }
      }
    },
    procError: function(eposmsg) {
      try {
        if (this.onerror != null) {
          this.onerror(eposmsg.sequence, eposmsg.deviceId, eposmsg.code, eposmsg.data)
        }
      } catch (e) {}
    },
    startReconnectAction: function() {
      if (this.conectionObj.status(this.conectionObj.IF_EPOSDEVICE) == this.conectionObj.RECONNECTING) {
        return
      }
      this.conectionObj.changeStatus(this.conectionObj.IF_EPOSDEVICE, this.conectionObj.RECONNECTING);
      this.reconnectTryCount = 0;
      var self = this;
      this.reconnectTimerId = setInterval(function() {
        if (self.socket != null) {
          self.gbox.stock(self.socket)
        }
        if (self.reconnectTryCount == self.MAX_RECONNECT_RETRY) {
          clearInterval(self.reconnectTimerId);
          self.cleanup();
          return
        }
        if (self.conectionObj.status(self.conectionObj.IF_EPOSDEVICE) == self.conectionObj.RECONNECTING) {
          self.connectBySocketIo(self.RECONNECT_TIMEOUT)
        }
        self.reconnectTryCount++
      }, self.RECONNECT_TIMEOUT);
      if (this.reconnectTryCount == 0 && this.onreconnecting != null) {
        this.onreconnecting()
      }
    },
    checkEposPrintService: function(deviceId, deviceType, callback) {
      this.cbCheckEposPrintService = callback;
      var self = this;
      var OK = "OK";
      var SSL_CONNECT_OK = "SSL_CONNECT_OK";
      var ERROR_TIMEOUT = "ERROR_TIMEOUT";
      var ERROR_PARAMETER = "ERROR_PARAMETER";
      var ERROR_SYSTEM = "SYSTEM_ERROR";
      var postUrl = null;
      var printUrl = this.conectionObj.getAddressWithProtocol() + "/cgi-bin/epos/service.cgi?devid=" + deviceId + "&timeout=10000";
      var displayUrl = this.conectionObj.getAddressWithProtocol() + "/cgi-bin/eposDisp/service.cgi?devid=" + deviceId + "&timeout=10000";
      var postData = null;
      var printData = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"></epos-print></s:Body></s:Envelope>';
      var displayData = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-display xmlns="http://www.epson-pos.com/schemas/2012/09/epos-display"></epos-display></s:Body></s:Envelope>';
      var xhr = null;
      var tid;
      var success;
      if (deviceType == this.DEVICE_TYPE_DISPLAY) {
        postUrl = displayUrl;
        postData = displayData
      } else {
        postUrl = printUrl;
        postData = printData
      }
      if (window.XDomainRequest) {
        try {
          xhr = new XDomainRequest();
          xhr.open("POST", postUrl);
          xhr.onload = function() {
            if (self.cbCheckEposPrintService != null) {
              if (/response/.test(xhr.responseText)) {
                success = /success\s*=\s*"\s*(1|true)\s*"/.test(xhr.responseText);
                if (success) {
                  self.cbCheckEposPrintService(OK);
                  self.cbCheckEposPrintService = null
                } else {
                  self.cbCheckEposPrintService(ERROR_PARAMETER);
                  self.cbCheckEposPrintService = null
                }
              } else {
                self.cbCheckEposPrintService(ERROR_PARAMETER);
                self.cbCheckEposPrintService = null
              }
            }
          };
          xhr.onerror = function() {
            if (self.cbCheckEposPrintService != null) {
              self.cbCheckEposPrintService(ERROR_PARAMETER);
              self.cbCheckEposPrintService = null
            }
          };
          xhr.ontimeout = function() {
            if (self.cbCheckEposPrintService != null) {
              self.cbCheckEposPrintService(ERROR_TIMEOUT);
              self.cbCheckEposPrintService = null
            }
          };
          xhr.onprogress = function() {};
          xhr.send(postData)
        } catch (e) {
          if (self.cbCheckEposPrintService != null) {
            self.cbCheckEposPrintService(ERROR_PARAMETER);
            self.cbCheckEposPrintService = null
          }
        }
      } else {
        try {
          xhr = new XMLHttpRequest();
          xhr.open("POST", postUrl, true);
          xhr.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
          xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jun 1970 00:00:00 GMT");
          xhr.setRequestHeader("SOAPAction", '""');
          xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
              clearTimeout(tid);
              if (self.cbCheckEposPrintService != null) {
                if ((xhr.status == 200) && (xhr.responseXML)) {
                  var res = xhr.responseXML.getElementsByTagName("response");
                  if (res.length <= 0) {
                    success = false
                  } else {
                    success = /^(1|true)$/.test(res[0].getAttribute("success"))
                  }
                  if (success) {
                    self.cbCheckEposPrintService(OK);
                    self.cbCheckEposPrintService = null
                  } else {
                    self.cbCheckEposPrintService(ERROR_PARAMETER);
                    self.cbCheckEposPrintService = null
                  }
                } else {
                  self.cbCheckEposPrintService(ERROR_PARAMETER);
                  self.cbCheckEposPrintService = null
                }
              }
            }
          };
          tid = setTimeout(function() {
            xhr.abort();
            if (self.cbCheckEposPrintService != null) {
              self.cbCheckEposPrintService(ERROR_TIMEOUT);
              self.cbCheckEposPrintService = null
            }
          }, 5000);
          xhr.timeout = 10000;
          xhr.send(postData)
        } catch (e) {
          if (self.cbCheckEposPrintService != null) {
            self.cbCheckEposPrintService(ERROR_PARAMETER);
            self.cbCheckEposPrintService = null
          }
        }
      }
    }
  };

  function SocketGarbageBox() {
    this.box = new Array()
  }
  SocketGarbageBox.prototype = {
    stock: function(socket) {
      if (socket == null) {
        return
      }
      socket.removeAllListeners("connect");
      socket.removeAllListeners("close");
      socket.removeAllListeners("disconnect");
      socket.removeAllListeners("error");
      socket.removeAllListeners("connect_failed");
      socket.removeAllListeners("message");
      var clone = function() {};
      clone.prototype = socket;
      this.box.push(clone)
    },
    dispose: function() {
      while (0 < this.box.length) {
        var socket = this.box.pop();
        try {
          socket.disconnect();
          // delete socket
        } catch (e) {}
      }
    }
  };

  function Connection() {
    this.OK = "OK";
    this.SSL_CONNECT_OK = "SSL_CONNECT_OK";
    this.ERROR_TIMEOUT = "ERROR_TIMEOUT";
    this.ERROR_PARAMETER = "ERROR_PARAMETER";
    this.ERROR_SYSTEM = "SYSTEM_ERROR";
    this.socket_p = null;
    this.address_p = "";
    this.protocol_p = "";
    this.port_p = "";
    this.callback_p = null;
    this.usableIF_p = 0;
    this.ws_status_p = 2;
    this.dev_status_p = 2;
    this.IF_EPOSDEVICE = 1;
    this.IF_EPOSPRINT = 2;
    this.IF_EPOSDISPLAY = 4;
    this.IF_ALL = 7;
    this.ACCESS_OK = "OK";
    this.ACCESS_ERROR = "ERROR";
    this.ACCESS_TIMEOUT = "TIMEOUT";
    this.ACCESS_NONE = "NONE";
    this.CONNECT = 1;
    this.DISCONNECT = 2;
    this.RECONNECTING = 4
  }
  Connection.prototype.probe = function(url, postdata, callback) {
    var probeSelf = this;
    var xhr = null;
    var tid;
    if (window.XDomainRequest) {
      try {
        xhr = new XDomainRequest();
        xhr.open("POST", url);
        xhr.onload = function() {
          callback(probeSelf.OK)
        };
        xhr.onerror = function() {
          callback(probeSelf.ERROR_PARAMETER)
        };
        xhr.ontimeout = function() {
          callback(probeSelf.ERROR_TIMEOUT)
        };
        xhr.onprogress = function() {};
        xhr.send(postdata)
      } catch (e) {
        callback(this.ERROR_PARAMETER)
      }
    } else {
      try {
        xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "text/xml; charset=utf-8");
        xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jun 1970 00:00:00 GMT");
        xhr.setRequestHeader("SOAPAction", '""');
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4) {
            clearTimeout(tid);
            if (xhr.status == 200) {
              callback(probeSelf.OK)
            } else {
              callback(probeSelf.ERROR_PARAMETER)
            }
          }
        };
        tid = setTimeout(function() {
          xhr.abort();
          callback(probeSelf.ERROR_TIMEOUT)
        }, 5000);
        xhr.timeout = 10000;
        xhr.send(postdata)
      } catch (e) {
        callback(this.ERROR_PARAMETER)
      }
    }
  };
  Connection.prototype.probeWebServiceIF = function(callback) {
    var startTime = (new Date()).getTime();
    var isPrintReceive = false;
    var isDisplayReceive = false;
    var isNotified = false;
    var probeSelf = this;
    var printUrl = this.getAddressWithProtocol() + "/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000";
    var printData = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"></epos-print></s:Body></s:Envelope>';
    this.probe(printUrl, printData, function(code) {
      var result = probeSelf.ACCESS_ERROR;
      if (code == probeSelf.OK) {
        result = probeSelf.ACCESS_OK
      }
      probeSelf.registIFAccessResult(probeSelf.IF_EPOSPRINT, result);
      isPrintReceive = true;
      if (isPrintReceive && isDisplayReceive) {
        if (!isNotified) {
          isNotified = true;
          callback(new Date().getTime() - startTime)
        }
      }
    });
    var displayUrl = this.getAddressWithProtocol() + "/cgi-bin/eposDisp/service.cgi?devid=local_display&timeout=10000";
    var displayData = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-display xmlns="http://www.epson-pos.com/schemas/2012/09/epos-display"></epos-display></s:Body></s:Envelope>';
    this.probe(displayUrl, displayData, function(code) {
      var result = probeSelf.ACCESS_ERROR;
      if (code == probeSelf.OK) {
        result = probeSelf.ACCESS_OK
      }
      probeSelf.registIFAccessResult(probeSelf.IF_EPOSDISPLAY, result);
      isDisplayReceive = true;
      if (isPrintReceive && isDisplayReceive) {
        if (!isNotified) {
          isNotified = true;
          callback(new Date().getTime() - startTime)
        }
      }
    })
  };
  Connection.prototype.setSocket = function(socket) {
    this.socket_p = socket
  };
  Connection.prototype.emit = function(eposmsg) {
    try {
      if (this.socket_p == null) {
        return
      }
      this.socket_p.emit("message", eposmsg.toTransmissionForm())
    } catch (e) {
      throw new Error(this.ERROR_SYSTEM)
    }
  };
  Connection.prototype.setAddress = function(protocol, address, port) {
    this.protocol_p = protocol;
    this.address_p = address;
    this.port_p = port;
    this.usableIF_p = 0
  };
  Connection.prototype.getAddressWithProtocol = function() {
    return this.protocol_p + "://" + this.address_p
  };
  Connection.prototype.getSocketIoURL = function() {
    return this.getAddressWithProtocol() + ":" + this.port_p
  };
  Connection.prototype.registCallback = function(callback) {
    if (typeof(callback) == "function") {
      this.callback_p = callback
    }
  };
  Connection.prototype.changeStatus = function(target, status) {
    switch (target) {
      case this.IF_ALL:
        this.dev_status_p = status;
        this.ws_status_p = status;
        break;
      case this.IF_EPOSDEVICE:
        this.dev_status_p = status;
        break;
      default:
        this.ws_status_p = status;
        break
    }
  };
  Connection.prototype.status = function(target) {
    if (target == this.IF_EPOSDEVICE) {
      return this.dev_status_p
    } else {
      return this.ws_status_p
    }
  };
  Connection.prototype.isUsableDeviceIF = function() {
    return ((this.usableIF_p & this.IF_EPOSDEVICE) == this.IF_EPOSDEVICE)
  };
  Connection.prototype.isUsablePrintIF = function() {
    if (this.isUsableDeviceIF()) {
      return true
    }
    return ((this.usableIF_p & this.IF_EPOSPRINT) == this.IF_EPOSPRINT)
  };
  Connection.prototype.isUsableDisplayIF = function() {
    if (this.isUsableDeviceIF()) {
      return true
    }
    return ((this.usableIF_p & this.IF_EPOSDISPLAY) == this.IF_EPOSDISPLAY)
  };
  Connection.prototype.registIFAccessResult = function(type, code) {
    if (code == this.ACCESS_OK) {
      this.changeStatus(type, this.CONNECT);
      this.usableIF_p |= type
    }
    if (type == this.IF_EPOSDEVICE) {
      var result = this.ERROR_PARAMETER;
      if (this.usableIF_p & this.IF_ALL) {
        if (this.protocol_p == "http") {
          result = this.OK
        } else {
          result = this.SSL_CONNECT_OK
        }
      }
      if (code == this.ACCESS_TIMEOUT) {
        result = this.ERROR_TIMEOUT
      }
      if (this.callback_p != null) {
        try {
          this.callback_p(result)
        } catch (e) {}
        this.callback_p = null
      }
    }
  };

  function ePosCrypto() {
    this.pubkey_c = "";
    this.secretKey = ""
  }
  ePosCrypto.prototype = {
    genClientKeys: function(arg_prime_s, arg_pubkey_s) {
      var g = str2bigInt("2", 10);
      var prime_c = str2bigInt(arg_prime_s, 16);
      var privkey_c = randBigInt(64, 0);
      this.pubkey_c = powMod(g, privkey_c, prime_c);
      var intPubkey = str2bigInt(arg_pubkey_s, 16);
      var modNum = powMod(intPubkey, privkey_c, prime_c);
      var strModNum = bigInt2str(modNum, 16);
      var strSecretKey = strModNum.toLowerCase();
      while (strSecretKey.length < 192) {
        strSecretKey = "0" + strSecretKey
      }
      this.secretKey = md5.bin(strSecretKey)
    },
    bfEncrypt: function(data) {
      try {
        var enc_req = {
          data: data,
          key: this.secretKey,
          mode: "cbc",
          round: 16,
          iv: blowfish.mkIV()
        };
        var enc_data = blowfish.encrypt(enc_req);
        var cdata = base64.encode(enc_data)
      } catch (e) {
        return ""
      }
      return cdata
    },
    bfDecrypt: function(data) {
      try {
        var dec_req = {
          data: base64.decode(data),
          key: this.secretKey,
          mode: "cbc"
        };
        var ddata = blowfish.decrypt(dec_req)
      } catch (e) {
        return ""
      }
      return ddata
    }
  };

  function ePosDeviceMessage() {
    this.REQUEST = {
      CONNECT: "connect",
      PUBKEY: "pubkey",
      ADMININFO: "admin_info",
      RECONNECT: "reconnect",
      DISCONNECT: "disconnect",
      OPENDEVICE: "open_device",
      CLOSEDEVICE: "close_device",
      DEVICEDATA: "device_data",
      SERVICEDATA: "service_data",
      ERROR: "error",
      OPENCOMMBOX: "open_commbox",
      CLOSECOMMBOX: "close_commbox",
      COMMDATA: "commbox_data"
    };
    this.request = null;
    this.sequence = 0;
    this.deviceId = "";
    this.serviceId = "";
    this.data = {};
    this.isCrypto = "0";
    this.code = "";
    this.data_id = 0
  }
  ePosDeviceMessage.prototype = {
    toTransmissionForm: function() {
      var message = null;
      switch (this.request) {
        case this.REQUEST.PUBKEY:
        case this.REQUEST.ADMININFO:
        case this.REQUEST.RECONNECT:
        case this.REQUEST.DISCONNECT:
          message = [this.request, this.data];
          break;
        case this.REQUEST.OPENDEVICE:
        case this.REQUEST.CLOSEDEVICE:
          message = [this.request, this.deviceId, this.data, this.data_id];
          break;
        case this.REQUEST.DEVICEDATA:
          message = [this.request, this.sequence, this.deviceId, this.data, this.data_id];
          break;
        case this.REQUEST.SERVICEDATA:
          message = [this.request, this.sequence, this.serviceId, this.isCrypto, this.data, this.data_id];
          break;
        case this.REQUEST.OPENCOMMBOX:
        case this.REQUEST.CLOSECOMMBOX:
        case this.REQUEST.COMMDATA:
          message = [this.request, this.sequence, this.data, this.data_id];
          break;
        default:
          message = null
      }
      return message
    },
  };
  var MessageFactory = (function() {
    var PUBKEY_TEST_TEXT = "hello";
    var sequence = 0;
    var cipher = new ePosCrypto();
    getNextSequence = function() {
      sequence++;
      if (Number.MAX_VALUE == sequence) {
        sequence = 1
      }
      return String(sequence)
    };
    return {
      parseRequestMessage: function(message) {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = message[0];
        switch (eposmsg.request) {
          case eposmsg.REQUEST.CONNECT:
            eposmsg.data = message[1];
            break;
          case eposmsg.REQUEST.PUBKEY:
          case eposmsg.REQUEST.ADMININFO:
          case eposmsg.REQUEST.RECONNECT:
          case eposmsg.REQUEST.DISCONNECT:
            eposmsg.code = message[1];
            eposmsg.data = message[2];
            break;
          case eposmsg.REQUEST.OPENDEVICE:
          case eposmsg.REQUEST.CLOSEDEVICE:
            eposmsg.deviceId = message[1];
            eposmsg.code = message[2];
            eposmsg.data = message[3];
            eposmsg.data_id = message[4];
            break;
          case eposmsg.REQUEST.DEVICEDATA:
            eposmsg.sequence = message[1];
            eposmsg.deviceId = message[2];
            eposmsg.data = message[3];
            eposmsg.data_id = message[4];
            break;
          case eposmsg.REQUEST.SERVICEDATA:
            eposmsg.sequence = message[1];
            eposmsg.serviceId = message[2];
            eposmsg.isCrypto = message[3];
            eposmsg.data = message[4];
            eposmsg.data_id = message[5];
            break;
          case eposmsg.REQUEST.OPENCOMMBOX:
          case eposmsg.REQUEST.CLOSECOMMBOX:
          case eposmsg.REQUEST.COMMDATA:
            eposmsg.sequence = message[1];
            eposmsg.data = message[2];
            eposmsg.data_id = message[3];
            break;
          case eposmsg.REQUEST.ERROR:
            eposmsg.sequence = message[1];
            eposmsg.deviceId = message[2];
            eposmsg.code = message[3];
            eposmsg.data = message[4];
            eposmsg.data_id = message[5];
            break;
          default:
            eposmsg = null
        }
        return eposmsg
      },
      getPubkeyMessage: function(prime, key) {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = eposmsg.REQUEST.PUBKEY;
        cipher.genClientKeys(prime, key);
        var testData = cipher.bfEncrypt(PUBKEY_TEST_TEXT);
        var pubkey = bigInt2str(cipher.pubkey_c, 16);
        while (pubkey.length < 192) {
          pubkey = "0" + pubkey
        }
        eposmsg.data = {
          key: pubkey,
          testData: testData
        };
        return eposmsg
      },
      getAdminInfoMessage: function() {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = eposmsg.REQUEST.ADMININFO;
        eposmsg.data = {};
        return eposmsg
      },
      getReconnectMessage: function(prevId, curId, dataId) {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = eposmsg.REQUEST.RECONNECT;
        eposmsg.data = {
          old_client_id: prevId,
          new_client_id: curId,
          received_id: dataId
        };
        return eposmsg
      },
      getDisconnectMessage: function(connectionId) {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = eposmsg.REQUEST.DISCONNECT;
        eposmsg.data = {
          client_id: connectionId
        };
        return eposmsg
      },
      getOpenDeviceMessage: function(deviceId, deviceType, isCrypto, isBufferEnable) {
        var eposmsg = new ePosDeviceMessage();
        var deviceTypeName = deviceType;
        if (deviceTypeName == "type_hybrid_printer2") {
          deviceTypeName = "type_hybrid_printer"
        }
        eposmsg.request = eposmsg.REQUEST.OPENDEVICE;
        eposmsg.deviceId = deviceId;
        eposmsg.data = {
          type: deviceTypeName,
          crypto: isCrypto,
          buffer: isBufferEnable
        };
        return eposmsg
      },
      getCloseDeviceMessage: function(deviceId) {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = eposmsg.REQUEST.CLOSEDEVICE;
        eposmsg.deviceId = deviceId;
        eposmsg.data = {};
        return eposmsg
      },
      getDeviceDataMessage: function(deviceId, data, crypto) {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = eposmsg.REQUEST.DEVICEDATA;
        eposmsg.sequence = getNextSequence();
        eposmsg.deviceId = deviceId;
        if (crypto) {
          eposmsg.data = cipher.bfEncrypt(JSON.stringify(data))
        } else {
          eposmsg.data = data
        }
        return eposmsg
      },
      getServiceMessage: function(serviceId, isCrypt, data) {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = eposmsg.REQUEST.SERVICEDATA;
        eposmsg.sequence = getNextSequence();
        eposmsg.serviceId = serviceId;
        eposmsg.isCrypto = isCrypt;
        if (isCrypt) {
          eposmsg.data = cipher.bfEncrypt(JSON.stringify(data))
        } else {
          eposmsg.data = data
        }
        return eposmsg
      },
      getOpenCommBoxMessage: function(data) {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = eposmsg.REQUEST.OPENCOMMBOX;
        eposmsg.sequence = getNextSequence();
        eposmsg.data = data;
        return eposmsg
      },
      getCloseCommBoxMessage: function(data) {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = eposmsg.REQUEST.CLOSECOMMBOX;
        eposmsg.sequence = getNextSequence();
        eposmsg.data = data;
        return eposmsg
      },
      getCommBoxDataMessage: function(data) {
        var eposmsg = new ePosDeviceMessage();
        eposmsg.request = eposmsg.REQUEST.COMMDATA;
        eposmsg.sequence = getNextSequence();
        eposmsg.data = data;
        return eposmsg
      },
      decrypt: function(data) {
        var decryptoData = cipher.bfDecrypt(data);
        return JSON.parse(decryptoData)
      },
    }
  }());

  function ePOSDeviceConfiguration(address) {
    this.DEVICE_GROUP_ALL = "group_all";
    this.DEVICE_GROUP_PRINTER = "group_printer";
    this.DEVICE_GROUP_DISPLAY = "group_display";
    this.DEVICE_GROUP_HID = "group_hid";
    this.DEVICE_GROUP_SERIAL = "group_serial";
    this.DEVICE_GROUP_OTHER = "group_other";
    this.DEVICE_TYPE_PRINTER = "type_printer";
    this.DEVICE_TYPE_HYBRID_PRINTER = "type_hybrid_printer";
    this.DEVICE_TYPE_DISPLAY = "type_display";
    this.DEVICE_TYPE_KEYBOARD = "type_keyboard";
    this.DEVICE_TYPE_SCANNER = "type_scanner";
    this.DEVICE_TYPE_MSR = "type_msr";
    this.DEVICE_TYPE_CASH_CHANGER = "type_cash_changer";
    this.DEVICE_TYPE_SIMPLE_SERIAL = "type_simple_serial";
    this.DEVICE_TYPE_CASH_DRAWER = "type_cash_drawer";
    this.DEVICE_TYPE_PIN_PAD = "type_pin_pad";
    this.DEVICE_TYPE_CAT = "type_cat";
    this.DEVICE_TYPE_SMARTCARD_RW = "type_smartcard_rw";
    this.CGI_PATH = "/epson_eposdevice/getDeviceList.cgi";
    this.RESULT_OK = "OK";
    this.UNKNOWN = "unknown";
    this.ONLINE = "online";
    this.OFFLINE = "offline";
    this.INTERVAL = 500;
    this.TIMEOUT = 60 * 1000;
    this.address = address;
    this.cb = null;
    this.message = null;
    this.WEBSOCKET_PORT = 8008;
    this.SSLWEBSOCKET_PORT = 8043
  }
  ePOSDeviceConfiguration.prototype.getRegisterdDevices = function(type, callback) {
    this.cb = callback;
    var self = this;
    var xhr = null;
    var protocol = window.location.protocol + "//";
    var param = "?group=" + type;
    var url = protocol + this.address + this.CGI_PATH + param;
    if (window.XDomainRequest) {
      xhr = new XDomainRequest();
      xhr.open("GET", url);
      xhr.onload = function() {
        self.message = self.RESULT_OK;
        var jsonObj = JSON.parse(xhr.responseText);
        self.checkDevice(jsonObj, function(resultList) {
          for (var key in resultList) {
            for (var i = 0; i < jsonObj.length; i++) {
              if (jsonObj[i].deviceId != key) {
                continue
              }
              jsonObj[i].status = resultList[key]
            }
          }
          if (self.cb != null) {
            self.cb(self, jsonObj);
            self.cb = null
          }
        })
      };
      xhr.onerror = function() {
        self.message = "Failed to get device list.";
        if (self.cb != null) {
          self.cb(self, null);
          self.cb = null
        }
      }
    } else {
      xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.setRequestHeader("Pragma", "no-cache");
      xhr.setRequestHeader("Cache-Control", "no-cache");
      xhr.setRequestHeader("If-Modified-Since", "Thu, 01 Jun 1970 00:00:00 GMT");
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          if (xhr.status == 200) {
            self.message = self.RESULT_OK;
            var jsonObj = JSON.parse(xhr.responseText);
            self.checkDevice(jsonObj, function(resultList) {
              for (var key in resultList) {
                for (var i = 0; i < jsonObj.length; i++) {
                  if (jsonObj[i].deviceId != key) {
                    continue
                  }
                  jsonObj[i].status = resultList[key]
                }
              }
              if (self.cb != null) {
                self.cb(self, jsonObj);
                self.cb = null
              }
            })
          } else {
            self.message = "Failed to get device list.";
            if (self.cb != null) {
              self.cb(self, null);
              self.cb = null
            }
          }
        }
      }
    }
    xhr.send(null)
  };
  ePOSDeviceConfiguration.prototype.checkDevice = function(obj, callback) {
    var self = this;
    var protocol = window.location.protocol;
    var port = (protocol.match(/^(https:)/)) ? this.SSLWEBSOCKET_PORT : this.WEBSOCKET_PORT;
    var ePosDev = new epson.ePOSDevice();
    var resultList = new Array();
    for (var i = 0; i < obj.length; i++) {
      resultList[obj[i].deviceId] = self.UNKNOWN
    }
    ePosDev.onerror = function(sq, deviceId, result) {
      if (deviceId != "") {
        resultList[deviceId] = self.OFFLINE
      }
    };
    ePosDev.connect(this.address, port, function(data) {
      if ((data == "OK") || (data == "SSL_CONNECT_OK")) {
        for (var i = 0; i < obj.length; i++) {
          ePosDev.createDevice(obj[i].deviceId, obj[i].deviceType, {}, function(data, code) {
            resultList[data.deviceID] = (code == "OK") ? self.ONLINE : self.OFFLINE;
            ePosDev.deleteDevice(data, null)
          })
        }
      }
    });
    var timer;
    timer = window.setInterval(function() {
      for (var key in resultList) {
        if (resultList[key] == self.UNKNOWN) {
          return
        }
      }
      clearInterval(timer);
      if (callback != null) {
        callback(resultList)
      }
    }, self.INTERVAL);
    window.setTimeout(function() {
      clearInterval(timer);
      if (callback != null) {
        callback(resultList)
      }
    }, self.TIMEOUT)
  };

  if (!window.epson) {
    window.epson = {}
  }
  window.epson.ePOSDevice = ePOSDevice;
  window.epson.ePOSDeviceConfiguration = ePOSDeviceConfiguration
})(window);