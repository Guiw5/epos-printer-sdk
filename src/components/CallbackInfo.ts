// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCallback = (...args: any[]) => void;

// CallbackInfo to manage callback storage.
// Keys are normalized to Number: the vendor transmitted sequence as a string
// and stored callbacks in a plain object (where keys coerce to string on
// both write and read), so "5" and 5 always matched. A Map does no coercion,
// and the device may echo the sequence back as either type, without
// normalizing, a string echo would silently never find its callback.
export class CallbackInfo {
  private map: Map<number, AnyCallback>;

  constructor() {
    this.map = new Map();
  }
  addCallback(callback: AnyCallback, sq: number | string): void {
      this.map.set(Number(sq), callback);
  }

  removeCallback(sq: number | string): void {
    this.map.delete(Number(sq));
  }

  getCallback(sq: number | string): AnyCallback | null {
    return this.map.get(Number(sq)) ?? null;
  }
}
