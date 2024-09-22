
// CallbackInfo to manage callback storage
export class CallbackInfo {
  private callbackInfoList: Record<number, Function> = {};

  addCallback(callback: Function, sequence: number): void {
      this.callbackInfoList[sequence] = callback;
  }

  removeCallback(sequence: number): void {
      delete this.callbackInfoList[sequence];
  }

  getCallback(sequence: number): Function | null {
      return this.callbackInfoList[sequence] || null;
  }
}
