// CallbackInfo to manage callback storage
export class CallbackInfo {
  private map: Map<number, Function>;

  constructor() {
    this.map = new Map();
  }
  addCallback(callback: Function, sq: number): void {
      this.map.set(sq, callback);
  }

  removeCallback(sq: number): void {
    this.map.delete(sq);
  }

  getCallback(sq: number): Function | null {
    return this.map.get(sq) ?? null;
  }
}
