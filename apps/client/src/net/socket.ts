import {
  Direction,
  ServerMsg,
  decodeServer,
  encodeMove,
  encodePlaceBomb,
  encodePing,
  encodeRequestStart,
  encodeSetReady,
  encodeEmote,
  type ServerMessage,
} from "./protocol.js";
import { SERVER_HTTP, SERVER_WS } from "../config.js";
import { loadWallet } from "./wallet.js";

export interface JoinResponse {
  code: string;
  token: string;
  wallet?: string | null; // wallet the server resolved from the session
}

async function post(path: string, body: Record<string, unknown>): Promise<Response> {
  const session = loadWallet()?.session;
  return fetch(`${SERVER_HTTP}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session ? { ...body, session } : body),
  });
}

export interface ProfileData {
  wallet: string;
  name: string;
  level: number;
  xp: number;
  matches: number;
  wins: number;
  frags: number;
  deaths: number;
  best_streak: number;
}

export async function fetchProfile(wallet: string): Promise<ProfileData> {
  const res = await fetch(`${SERVER_HTTP}/profile?wallet=${encodeURIComponent(wallet)}`);
  return res.json();
}

export async function fetchLeaderboard(): Promise<ProfileData[]> {
  const res = await fetch(`${SERVER_HTTP}/leaderboard`);
  const { rows } = (await res.json()) as { rows: ProfileData[] };
  return rows ?? [];
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

export async function practiceRoom(name: string, skin: number): Promise<JoinResponse> {
  const res = await post("/practice", { name, skin });
  if (!res.ok) throw new Error(`practice failed: ${res.status}`);
  return res.json();
}

export async function joinRoom(name: string, code: string, skin: number): Promise<JoinResponse> {
  const res = await post("/join", { name, code, skin });
  if (res.status === 404) throw new Error("Room not found");
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
  return res.json();
}

const MAX_RECONNECT_ATTEMPTS = 8;
const RECONNECT_DELAY_MS = 1500;

export class Net {
  private ws: WebSocket | null = null;
  private seq = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectToken = "";
  private intentional = false;
  private attempts = 0;

  onMessage: (msg: ServerMessage) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  /** Fired when a dropped connection is being retried (attempt number). */
  onReconnecting: (attempt: number) => void = () => {};

  connect(token: string): void {
    this.intentional = false;
    this.attempts = 0;
    this.reconnectToken = "";
    this.open(`token=${encodeURIComponent(token)}`);
  }

  private open(query: string): void {
    const ws = new WebSocket(`${SERVER_WS}?${query}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.onOpen();
      this.pingTimer = setInterval(() => this.sendPing(), 1000);
    };
    ws.onmessage = (ev) => {
      const msg = decodeServer(ev.data as ArrayBuffer);
      if (!msg) return;
      // Intercept the reconnect handle; everything else flows to the game.
      if (msg.type === ServerMsg.RECONNECT_TOKEN) {
        this.reconnectToken = msg.token;
        return;
      }
      this.onMessage(msg);
    };
    ws.onclose = () => this.handleClose();
    ws.onerror = () => ws.close();
  }

  private handleClose(): void {
    this.cleanup();
    if (this.intentional) {
      this.onClose();
      return;
    }
    // Unexpected drop: retry with the reconnect handle for a while.
    if (this.reconnectToken && this.attempts < MAX_RECONNECT_ATTEMPTS) {
      this.attempts += 1;
      this.onReconnecting(this.attempts);
      setTimeout(() => {
        if (!this.intentional) this.open(`reconnect=${encodeURIComponent(this.reconnectToken)}`);
      }, RECONNECT_DELAY_MS);
      return;
    }
    this.onClose();
  }

  private send(bytes: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(bytes);
  }

  sendMove(dir: Direction, tick: number): void {
    this.send(encodeMove(dir, tick));
  }

  sendBomb(): void {
    this.send(encodePlaceBomb(++this.seq));
  }

  sendStart(): void {
    this.send(encodeRequestStart());
  }

  sendReady(ready: boolean): void {
    this.send(encodeSetReady(ready));
  }

  sendEmote(emote: number): void {
    this.send(encodeEmote(emote));
  }

  sendPing(): void {
    this.send(encodePing(performance.now()));
  }

  private cleanup(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  close(): void {
    this.intentional = true;
    this.cleanup();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
  }
}
