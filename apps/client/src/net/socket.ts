import {
  Direction,
  decodeServer,
  encodeMove,
  encodePlaceBomb,
  encodePing,
  encodeRequestStart,
  type ServerMessage,
} from "./protocol.js";
import { SERVER_HTTP, SERVER_WS } from "../config.js";

export interface JoinResponse {
  code: string;
  token: string;
}

async function post(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${SERVER_HTTP}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function quickplay(name: string, skin: number): Promise<JoinResponse> {
  const res = await post("/quickplay", { name, skin });
  if (!res.ok) throw new Error(`quickplay failed: ${res.status}`);
  return res.json();
}

export async function createRoom(name: string, skin: number): Promise<JoinResponse> {
  const res = await post("/create", { name, skin });
  if (!res.ok) throw new Error(`create failed: ${res.status}`);
  return res.json();
}

export async function joinRoom(name: string, code: string, skin: number): Promise<JoinResponse> {
  const res = await post("/join", { name, code, skin });
  if (res.status === 404) throw new Error("Room not found");
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
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

  sendMove(dir: Direction): void {
    this.send(encodeMove(dir, ++this.seq));
  }

  sendBomb(): void {
    this.send(encodePlaceBomb(++this.seq));
  }

  sendStart(): void {
    this.send(encodeRequestStart());
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
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
  }
}
