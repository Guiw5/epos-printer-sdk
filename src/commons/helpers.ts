import { ePOSPrint } from "../builders/ePOSPrint";

// Helper functions
export function fireReceiveEvent(epos: ePOSPrint, success: boolean, code: string, status: number, battery: number, printjobid: string) {
  if (code === "EX_ENPC_TIMEOUT") {
    code = "ERROR_DEVICE_BUSY";
  }
  if (epos.onreceive) {
    epos.onreceive({ success, code, status, battery, printjobid });
  }
}

export function fireStatusEvent(epos: ePOSPrint, status: number, battery: number) {
  const diff = epos.status === 0 ? ~0 : epos.status ^ status;
  const difb = epos.status === 0 ? ~0 : epos.battery ^ battery;

  epos.status = status;
  epos.battery = battery;

  if (diff && epos.onstatuschange) {
    epos.onstatuschange(status);
  }
  if (difb && epos.onbatterystatuschange) {
    epos.onbatterystatuschange(battery);
  }

  handleStatusDiff(epos, status, diff);
}

export function handleStatusDiff(epos: ePOSPrint, status: number, diff: number) {
  if (diff & (epos.ASB_NO_RESPONSE | epos.ASB_OFF_LINE)) {
    if (status & epos.ASB_NO_RESPONSE && epos.onpoweroff) {
      epos.onpoweroff();
    } else if (status & epos.ASB_OFF_LINE && epos.onoffline) {
      epos.onoffline();
    } else if (epos.ononline) {
      epos.ononline();
    }
  }

  if (diff & epos.ASB_COVER_OPEN && epos.oncoveropen) {
    epos.oncoveropen();
  } else if (epos.oncoverok) {
    epos.oncoverok();
  }

  if (diff & (epos.ASB_RECEIPT_END | epos.ASB_RECEIPT_NEAR_END)) {
    if (status & epos.ASB_RECEIPT_END && epos.onpaperend) {
      epos.onpaperend();
    } else if (status & epos.ASB_RECEIPT_NEAR_END && epos.onpapernearend) {
      epos.onpapernearend();
    } else if (epos.onpaperok) {
      epos.onpaperok();
    }
  }
}
