declare module 'socket.io-client' {
  export const version: string;
  export const protocol: number;
  export const transports: string[];
  export const sockets: { [key: string]: Socket };

  export function connect(host: string, details?: any): Socket;

  export namespace util {
    export function parseUri(str: string): any;
    export function uniqueUri(uri: any): string;
    export function query(base: string, addition: string): string;
    export function chunkQuery(qs: string): any;
    export function merge(target: any, additional: any, deep?: number, lastseen?: any): any;
    export function on(element: any, event: string, fn: Function, capture: boolean): void;
    export function request(xdomain?: boolean): XMLHttpRequest | XDomainRequest | null;
    export function load(fn: Function): void;
    export function defer(fn: Function): void;
    export function mixin(ctor: any, ctor2: any): void;
    export function inherit(ctor: any, ctor2: any): void;
    export function isArray(obj: any): boolean;
    export function intersect(arr: any[], arr2: any[]): any[];
    export function indexOf(arr: any[], o: any, i?: number): number;
    export function toArray(enu: any): any[];

    export namespace ua {
      export const hasCORS: boolean;
      export const webkit: boolean;
    }
  }

  export class Flag {
    constructor(nsp: io.SocketNamespace, name: string);
    send(...args: any[]): void;
    emit(...args: any[]): void;
  }
  export class EventEmitter {
    on(event: string, fn: Function): this;
    addListener(event: string, fn: Function): this;
    once(event: string, fn: Function): this;
    removeListener(event: string, fn: Function): this;
    removeAllListeners(event: string): this;
    listeners(event: string): Function[];
    emit(event: string, ...args: any[]): boolean;
  }

  export class Socket extends EventEmitter {
    constructor(options: any);

    connect(fn?: Function): this;
    disconnect(): this;
    packet(data: any): this;
    setBuffer(v: boolean): void;
    of(namespace: string): SocketNamespace;
    onConnect(): void;
    onClose(): void;
    onPacket(packet: any): void;
    onError(err: any): void;
    onDisconnect(reason: string): void;
  }

  export class SocketNamespace extends EventEmitter {
    constructor(socket: Socket, name: string);

    send(data: any, fn?: Function): this;
    emit(event: string, ...args: any[]): this;
    disconnect(): this;
    onPacket(packet: any): void;
  }

  export namespace parser {
    export const packets: string[];
    export const reasons: string[];
    export const advice: string[];

    export function encodePacket(packet: any): string;
    export function encodePayload(packets: any[]): string;
    export function decodePacket(data: string): any;
    export function decodePayload(data: string): any[];
  }

  export namespace Transport {
    export class Transport extends EventEmitter {
      constructor(socket: Socket, sessid: string);
      onData(data: string): this;
      onPacket(packet: any): this;
      setCloseTimeout(): void;
      onConnect(): this;
      onDisconnect(): this;
      clearCloseTimeout(): void;
      clearTimeouts(): void;
      packet(data: any): void;
      onOpen(): void;
      onClose(): void;
    }
  }

  export namespace transports {
    export class WebSocket extends Transport {
      open(): this;
      send(data: string): this;
      payload(arr: any[]): this;
      close(): this;
      onError(e: Error): void;
      scheme(): string;

      static check(): boolean;
      static xdomainCheck(): boolean;

      // Reflect the JavaScript name assignment
      public readonly name: "websocket";

    }

    export class FlashSocket extends WebSocket {
      open(): this;
      send(data: string): this;
      close(): this;
      ready(socket: Socket, fn: Function): void;

      static xdomainCheck(): boolean;
    }

    export class XHR extends Transport {
      open(): this;
      payload(arr: any[]): this;
      send(data: string): this;
      close(): this;

      static check(socket?: Socket, xdomain?: boolean): boolean;
      static xdomainCheck(): boolean;
    }

    export class htmlfile extends XHR {
      get(): void;
      close(): this;

      static check(): boolean;
      static xdomainCheck(): boolean;
    }

    export class XHRPolling extends XHR {
      open(): this;
      get(): void;
      close(): this;

      // Ensure compatibility with the JavaScript version
      public readonly name: "xhr-polling";
    }

    export class JSONPPolling extends XHR {
      post(data: any): void;
      get(): void;

      // Ensure compatibility with the JavaScript version
      public readonly name: "jsonp-polling";
    }
  }
}
