// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCallback = (...args: any[]) => void;

// CallbackInfo to manage callback storage
export class CallbackInfo {
  private map: Map<number, AnyCallback>;

  constructor() {
    this.map = new Map();
  }
  addCallback(callback: AnyCallback, sq: number): void {
      this.map.set(sq, callback);
  }

  removeCallback(sq: number): void {
    this.map.delete(sq);
  }

  getCallback(sq: number): AnyCallback | null {
    return this.map.get(sq) ?? null;
  }
}
