import {
  Direction,
  decodeServer,
  encodeMove,
  encodePlaceBomb,
  encodePing,
  type ServerMessage,
} from "./protocol.js";
import { SERVER_HTTP, SERVER_WS } from "../config.js";

export interface QuickplayResponse {
  roomId: string;
  token: string;
}

export async function quickplay(name: string): Promise<QuickplayResponse> {
  const res = await fetch(`${SERVER_HTTP}/quickplay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`quickplay failed: ${res.status}`);
  return res.json();
}

export class Net {
  private ws: WebSocket | null = null;
  private seq = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  onMessage: (msg: ServerMessage) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};

  connect(token: string): void {
    const ws = new WebSocket(`${SERVER_WS}?token=${encodeURIComponent(token)}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.onOpen();
      this.pingTimer = setInterval(() => this.sendPing(), 1000);
    };
    ws.onmessage = (ev) => {
      const msg = decodeServer(ev.data as ArrayBuffer);
      if (msg) this.onMessage(msg);
    };
    ws.onclose = () => {
      this.cleanup();
      this.onClose();
    };
    ws.onerror = () => ws.close();
  }

  private send(bytes: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(bytes);
  }

  nextSeq(): number {
    return ++this.seq;
  }

  sendMove(dir: Direction): void {
    this.send(encodeMove(dir, this.nextSeq()));
  }

  sendBomb(): void {
    this.send(encodePlaceBomb(this.nextSeq()));
  }

  sendPing(): void {
    this.send(encodePing(performance.now()));
  }

  private cleanup(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  close(): void {
    this.cleanup();
    this.ws?.close();
    this.ws = null;
  }
}
