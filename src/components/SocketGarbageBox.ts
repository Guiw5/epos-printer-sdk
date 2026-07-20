import type { LegacySocket } from "../types";

export class SocketGarbageBox {
  private box: LegacySocket[] = [];

  constructor() {
    this.box = [];
  }

  stock(socket: LegacySocket): void {
    if (!socket) {
      return;
    }
    
    socket.removeAllListeners("connect");
    socket.removeAllListeners("close");
    socket.removeAllListeners("disconnect");
    socket.removeAllListeners("error");
    socket.removeAllListeners("connect_failed");
    socket.removeAllListeners("message");
    
    const clone = Object.create(socket);
    this.box.push(clone);
  }

  dispose(): void {
    while (this.box.length > 0) {
      let socket = this.box.pop();
      try {
        if (socket) {
          socket.disconnect();
          socket = undefined;
        }
      } catch (e) {
        console.error("Error disconnecting socket:", e);
      }
    }
  }
}
