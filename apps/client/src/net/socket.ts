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
  encodeKick,
  encodeSetSkin,
  encodeChat,
  encodeSetStake,
  encodeProposeStake,
  encodeVoteStake,
  type ServerMessage,
} from "./protocol.js";
import { SERVER_HTTP, SERVER_WS } from "../config.js";
import { loadWallet } from "./wallet.js";
import type { SandboxOpts } from "@bomberpump/shared";

export interface JoinResponse {
  code: string;
  token: string;
  wallet?: string | null; // wallet the server resolved from the session
  chips?: number; // current chip balance (when wallet-authenticated)
  gameTokens?: number; // custodial in-game token balance
}

async function post(path: string, body: Record<string, unknown>): Promise<Response> {
  const session = loadWallet()?.session;
  return fetch(`${SERVER_HTTP}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session ? { ...body, session } : body),
  });
}

/** `&session=…` query fragment for authenticated GETs (empty if not signed in). */
function sessionQS(): string {
  const s = loadWallet()?.session;
  return s ? `&session=${encodeURIComponent(s)}` : "";
}

export interface ProfileData {
  wallet: string;
  name: string;
  skin: number; // currently equipped skin
  skins: number; // owned-skins bitmask
  level: number;
  xp: number;
  matches: number;
  wins: number;
  frags: number;
  deaths: number;
  best_streak: number;
  chips: number;
  rating: number;
  week_points: number;
  tokens_won?: number; // lifetime real-token winnings (base units)
  chips_won?: number; // lifetime chips winnings
  gameTokens?: number; // custodial in-game token balance (whole tokens)
  walletTokens?: number; // live on-chain balance in the player's wallet
}

export interface BankInfo {
  treasury: string;
  ticker: string;
  mint: string;
  depositsEnabled: boolean;
  withdrawalsEnabled: boolean;
  minWithdraw: number;
  maxWithdraw: number;
  gameTokens: number;
  walletTokens: number;
}

export async function fetchBank(wallet: string): Promise<BankInfo> {
  const res = await fetch(`${SERVER_HTTP}/bank?wallet=${encodeURIComponent(wallet)}${sessionQS()}`);
  return res.json();
}

export async function withdrawTokens(amount: number): Promise<{ signature?: string; gameTokens?: number; error?: string }> {
  const res = await post("/withdraw", { amount });
  return res.json();
}

export async function fetchPrice(): Promise<number> {
  try {
    const res = await fetch(`${SERVER_HTTP}/price`);
    const { usd } = (await res.json()) as { usd: number };
    return Number(usd) || 0;
  } catch {
    return 0;
  }
}

export async function prepareDeposit(amount: number): Promise<{ tx?: string; error?: string }> {
  const res = await post("/deposit/prepare", { amount });
  return res.json();
}

export async function claimDeposit(
  signature: string,
): Promise<{ ok: boolean; wallet?: string; amount?: number; already?: boolean; reason?: string; expected?: string; seen?: string[]; debug?: string }> {
  const res = await post("/deposit/claim", { signature });
  return res.json();
}

export async function fetchProfile(wallet: string): Promise<ProfileData> {
  // Session lets the server include YOUR private balances; for other players it
  // returns public stats only.
  const res = await fetch(`${SERVER_HTTP}/profile?wallet=${encodeURIComponent(wallet)}${sessionQS()}`);
  return res.json();
}

export async function buySkin(
  skin: number,
): Promise<{ chips?: number; skins?: number; skin?: number; error?: string; needLevel?: number }> {
  const res = await post("/shop/buy-skin", { skin });
  return res.json();
}

export async function buySkinToken(
  skin: number,
): Promise<{ gameTokens?: number; skins?: number; skin?: number; error?: string }> {
  const res = await post("/shop/buy-skin-token", { skin });
  return res.json();
}

export async function setNickname(name: string): Promise<{ ok?: boolean; name?: string; error?: string }> {
  const res = await post("/profile/name", { name });
  return res.json();
}

export async function selectSkin(skin: number): Promise<{ skin?: number; error?: string }> {
  const res = await post("/shop/select-skin", { skin });
  return res.json();
}

export type LbBoard = "rating" | "tokens" | "chips";
export async function fetchLeaderboard(board: LbBoard = "rating"): Promise<ProfileData[]> {
  const res = await fetch(`${SERVER_HTTP}/leaderboard?board=${board}`);
  const { rows } = (await res.json()) as { rows: ProfileData[] };
  return rows ?? [];
}

export interface TableInfo {
  code: string;
  stake: number;
  currency: number; // 0 = chips, 1 = token
  players: number;
  max: number;
  live: boolean; // a match is in progress -> watch instead of join
}

/** Reserve a watch-only token for a live match (specific code, or any). */
export async function watchMatch(code?: string): Promise<JoinResponse> {
  const res = await fetch(`${SERVER_HTTP}/watch${code ? `?code=${encodeURIComponent(code)}` : ""}`);
  if (!res.ok) throw new Error("No live match to watch right now.");
  return res.json();
}

export async function fetchTables(): Promise<TableInfo[]> {
  try {
    const res = await fetch(`${SERVER_HTTP}/tables`);
    const { tables } = (await res.json()) as { tables: TableInfo[] };
    return tables ?? [];
  } catch {
    return [];
  }
}

/** Turn a server error body into a friendly message (e.g. not enough chips). */
async function joinError(res: Response): Promise<Error> {
  let body: { error?: string; balance?: number; stake?: number } = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  if (body.error === "insufficient_chips")
    return new Error(`Not enough chips: need ${body.stake}, you have ${body.balance}`);
  if (body.error === "insufficient_tokens")
    return new Error(`Not enough tokens: need ${body.stake}, you have ${body.balance}. Deposit in the Bank.`);
  if (body.error === "wallet_required") return new Error("Connect a wallet to play staked tables");
  if (res.status === 404) return new Error("Room not found");
  if (body.error === "server_full") return new Error("Server full — try again");
  return new Error(`Failed (${res.status})`);
}

export async function quickplay(name: string, skin: number, stake = 0): Promise<JoinResponse> {
  const res = await post("/quickplay", { name, skin, stake });
  if (!res.ok) throw await joinError(res);
  return res.json();
}

export async function createRoom(
  name: string,
  skin: number,
  stake = 0,
  currency = 0,
): Promise<JoinResponse> {
  const res = await post("/create", { name, skin, stake, currency });
  if (!res.ok) throw await joinError(res);
  return res.json();
}

export async function practiceRoom(
  name: string,
  skin: number,
  difficulty = 1,
  bots = 3,
  competitive = false,
  sandbox: SandboxOpts | null = null,
): Promise<JoinResponse> {
  const res = await post("/practice", { name, skin, difficulty, bots, competitive, sandbox });
  if (!res.ok) throw await joinError(res);
  return res.json();
}

export async function joinRoom(name: string, code: string, skin: number): Promise<JoinResponse> {
  const res = await post("/join", { name, code, skin });
  if (!res.ok) throw await joinError(res);
  return res.json();
}

/** Bind the inviter to this (session-verified) wallet. An empty ref lets the
 *  server fall back to the root (owner), so un-invited players still attach. */
export async function attributeReferral(ref: string): Promise<boolean> {
  if (!loadWallet()?.session) return false;
  try {
    const r = await post("/referral/attribute", { ref });
    const j = (await r.json()) as { ok?: boolean };
    return !!j.ok;
  } catch {
    return false;
  }
}

export interface ReferralStats {
  direct: number;
  earned: number; // whole tokens earned lifetime
  levels: number[]; // payout % per level
  network: number[]; // your downline count at each level L1..L5
  rakePct: number; // house rake %, for the earnings calculator
}

export async function fetchReferralStats(wallet: string): Promise<ReferralStats> {
  try {
    const r = await fetch(`${SERVER_HTTP}/referral/stats?wallet=${encodeURIComponent(wallet)}`);
    return (await r.json()) as ReferralStats;
  } catch {
    return { direct: 0, earned: 0, levels: [], network: [], rakePct: 0 };
  }
}

// --- friends + presence ----------------------------------------------------
export interface FriendInfo {
  wallet: string;
  name: string;
  status: string; // "friends" | "in" | "out"
  online: boolean;
  room: string; // joinable lobby code, "" if not joinable
}
export interface FriendsData {
  friends: FriendInfo[];
  incoming: Array<{ wallet: string; name: string }>;
  outgoing: Array<{ wallet: string; name: string }>;
}

/** Fetch friends/requests AND beat presence (marks you online with `room`). */
export async function fetchFriends(room = "", status = "menu"): Promise<FriendsData> {
  try {
    const res = await fetch(
      `${SERVER_HTTP}/friends?room=${encodeURIComponent(room)}&status=${encodeURIComponent(status)}${sessionQS()}`,
    );
    if (!res.ok) return { friends: [], incoming: [], outgoing: [] };
    return (await res.json()) as FriendsData;
  } catch {
    return { friends: [], incoming: [], outgoing: [] };
  }
}
export async function addFriend(name: string): Promise<{ ok?: boolean; result?: string; error?: string }> {
  const r = await post("/friends/add", { name });
  return r.json();
}
export async function acceptFriend(wallet: string): Promise<void> {
  await post("/friends/accept", { wallet });
}
export async function removeFriend(wallet: string): Promise<void> {
  await post("/friends/remove", { wallet });
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
    document.addEventListener("visibilitychange", this.onVisible);
    this.open(`token=${encodeURIComponent(token)}`);
  }

  // Mobile browsers freeze JS in a locked/backgrounded tab, so the retry
  // timers below don't fire. The moment we're visible again, force an
  // immediate reconnect if the socket dropped while we were away.
  private onVisible = (): void => {
    if (this.intentional || document.visibilityState !== "visible") return;
    const closed = !this.ws || this.ws.readyState === WebSocket.CLOSED;
    if (closed && this.reconnectToken) {
      this.attempts = 0;
      this.open(`reconnect=${encodeURIComponent(this.reconnectToken)}`);
    }
  };

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

  sendSetStake(stake: number): void {
    this.send(encodeSetStake(stake));
  }

  sendProposeStake(stake: number): void {
    this.send(encodeProposeStake(stake));
  }

  sendVoteStake(accept: boolean): void {
    this.send(encodeVoteStake(accept));
  }

  sendEmote(emote: number): void {
    this.send(encodeEmote(emote));
  }

  sendKick(targetId: number): void {
    this.send(encodeKick(targetId));
  }

  sendSkin(skin: number): void {
    this.send(encodeSetSkin(skin));
  }

  sendChat(text: string): void {
    this.send(encodeChat(text));
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
    document.removeEventListener("visibilitychange", this.onVisible);
    this.cleanup();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
  }
}
