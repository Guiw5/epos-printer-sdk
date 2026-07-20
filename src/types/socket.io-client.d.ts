// Hand-written minimal types for socket.io-client@0.8.7 — the package
// predates TypeScript and ships no declarations of its own. Internal only:
// this file is NOT part of the build output, so nothing in the public .d.ts
// surface may import from 'socket.io-client' (use LegacySocket from
// src/types.ts instead). Only the surface the library actually calls is
// declared here; everything else the package exports is intentionally
// omitted.
declare module 'socket.io-client' {
  interface Socket {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, fn: (...args: any[]) => void): Socket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit(event: string, ...args: any[]): unknown;
    disconnect(): Socket;
    removeAllListeners(event: string): Socket;
  }

  const io: {
    connect(host: string, options?: Record<string, unknown>): Socket;
  };

  export default io;
}
