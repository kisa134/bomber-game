// Solana wallet inside Telegram via Phantom deeplinks + a server relay.
//
// Telegram's webview has no wallet extension, so Wallet Standard finds nothing.
// Instead we drive Phantom's encrypted deeplink protocol (x25519 + nacl.box).
// Each Phantom round-trip RELOADS the Mini App (Phantom -> /tg/cb -> t.me link),
// so the connect→sign-in→deposit flow is a state machine resumed on boot from
// localStorage + the `startapp` parameter, not a single straight-through call.

import nacl from "tweetnacl";
import bs58 from "bs58";
import { SERVER_HTTP } from "../config.js";
import { getStartParam, openExternal } from "../platform/telegram.js";

export const TG_WALLET_NAME = "Telegram (Phantom)";
const PHANTOM_BASE = "https://phantom.app/ul/v1";
const CLUSTER = "mainnet-beta";

const K_KP = "bp_tg_dapp"; // dapp encryption keypair
const K_SESS = "bp_tg_sess"; // shared secret + phantom session + address
const K_PENDING = "bp_tg_pending"; // in-flight deeplink op

interface DappKp {
  secret: string;
  public: string;
}
interface TgSession {
  shared: string; // bs58 shared secret
  session: string; // phantom session token
  address: string; // wallet pubkey (base58)
}
type Pending =
  | { kind: "connect"; state: string }
  | { kind: "sign"; state: string; nonce: string; address: string }
  | { kind: "deposit"; state: string };

export interface ResumeHandlers {
  onConnected(address: string): void;
  onDeposit(signature: string): void;
  onError(message: string): void;
}

// --- small helpers ---------------------------------------------------------

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function dappKeypair(): nacl.BoxKeyPair {
  const stored = load<DappKp>(K_KP);
  if (stored) {
    return { secretKey: bs58.decode(stored.secret), publicKey: bs58.decode(stored.public) };
  }
  const kp = nacl.box.keyPair();
  localStorage.setItem(
    K_KP,
    JSON.stringify({ secret: bs58.encode(kp.secretKey), public: bs58.encode(kp.publicKey) }),
  );
  return kp;
}

function encrypt(obj: unknown, shared: Uint8Array): { nonce: string; payload: string } {
  const nonce = nacl.randomBytes(24);
  const msg = new TextEncoder().encode(JSON.stringify(obj));
  const box = nacl.box.after(msg, nonce, shared);
  return { nonce: bs58.encode(nonce), payload: bs58.encode(box) };
}

function decrypt(data: string, nonce: string, shared: Uint8Array): Record<string, unknown> {
  const out = nacl.box.open.after(bs58.decode(data), bs58.decode(nonce), shared);
  if (!out) throw new Error("Failed to decrypt Phantom response");
  return JSON.parse(new TextDecoder().decode(out)) as Record<string, unknown>;
}

async function newState(): Promise<string> {
  const r = await fetch(`${SERVER_HTTP}/tg/relay/new`, { method: "POST" });
  const { state } = (await r.json()) as { state: string };
  return state;
}

function redirectLink(state: string): string {
  return `${SERVER_HTTP}/tg/cb?state=${encodeURIComponent(state)}`;
}

function setPending(p: Pending): void {
  localStorage.setItem(K_PENDING, JSON.stringify(p));
}

export function isTgWalletConnected(): boolean {
  return !!load<TgSession>(K_SESS);
}

// --- outbound deeplinks ----------------------------------------------------

/** Step 1: open Phantom to connect. On return we kick off the sign-in step. */
export async function startTelegramConnect(): Promise<void> {
  const kp = dappKeypair();
  const state = await newState();
  setPending({ kind: "connect", state });
  const params = new URLSearchParams({
    app_url: window.location.origin,
    dapp_encryption_public_key: bs58.encode(kp.publicKey),
    redirect_link: redirectLink(state),
    cluster: CLUSTER,
  });
  openExternal(`${PHANTOM_BASE}/connect?${params.toString()}`);
}

/** Deposit: have Phantom sign+send a server-built (base64) transaction. */
export async function telegramSignAndSend(base64Tx: string): Promise<void> {
  const sess = load<TgSession>(K_SESS);
  if (!sess) throw new Error("Connect your wallet first");
  const shared = bs58.decode(sess.shared);
  const txBytes = Uint8Array.from(atob(base64Tx), (c) => c.charCodeAt(0));
  const { nonce, payload } = encrypt(
    { transaction: bs58.encode(txBytes), session: sess.session },
    shared,
  );
  const state = await newState();
  setPending({ kind: "deposit", state });
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappKeypair().publicKey),
    nonce,
    redirect_link: redirectLink(state),
    payload,
  });
  openExternal(`${PHANTOM_BASE}/signAndSendTransaction?${params.toString()}`);
}

async function startSignIn(address: string): Promise<void> {
  const sess = load<TgSession>(K_SESS);
  if (!sess) throw new Error("Not connected");
  // Server nonce, then sign the exact message /auth/verify reconstructs.
  const nonceRes = await fetch(`${SERVER_HTTP}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey: address }),
  });
  const { nonce } = (await nonceRes.json()) as { nonce: string };
  const message = new TextEncoder().encode(
    `Bombermeme\nSign in to verify wallet ownership.\n\nNonce: ${nonce}`,
  );
  const shared = bs58.decode(sess.shared);
  const enc = encrypt(
    { message: bs58.encode(message), session: sess.session, display: "utf8" },
    shared,
  );
  const state = await newState();
  setPending({ kind: "sign", state, nonce, address });
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappKeypair().publicKey),
    nonce: enc.nonce,
    redirect_link: redirectLink(state),
    payload: enc.payload,
  });
  openExternal(`${PHANTOM_BASE}/signMessage?${params.toString()}`);
}

// --- inbound: resume a pending flow on app load ----------------------------

async function fetchRelay(state: string): Promise<URLSearchParams> {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${SERVER_HTTP}/tg/relay/${encodeURIComponent(state)}`);
    if (r.ok) {
      const { payload } = (await r.json()) as { payload: string };
      return new URLSearchParams(payload);
    }
    await new Promise((res) => setTimeout(res, 400));
  }
  throw new Error("No response from Phantom (timed out)");
}

function phantomError(q: URLSearchParams): string | null {
  const code = q.get("errorCode");
  if (!code) return null;
  return q.get("errorMessage") || `Phantom error ${code}`;
}

/** Called once on boot. If we returned from a Phantom deeplink, finish the step.
 *  Returns true if a pending flow was handled. */
export async function resumeTelegramWallet(h: ResumeHandlers): Promise<boolean> {
  const sp = getStartParam();
  const pending = load<Pending>(K_PENDING);
  if (!sp || !pending || pending.state !== sp) return false;
  try {
    const q = await fetchRelay(pending.state);
    const err = phantomError(q);
    if (err) {
      localStorage.removeItem(K_PENDING);
      h.onError(err);
      return true;
    }
    const data = q.get("data") ?? "";
    const nonce = q.get("nonce") ?? "";

    if (pending.kind === "connect") {
      const phantomPub = q.get("phantom_encryption_public_key") ?? "";
      const shared = nacl.box.before(bs58.decode(phantomPub), dappKeypair().secretKey);
      const res = decrypt(data, nonce, shared);
      const address = String(res.public_key ?? "");
      const session = String(res.session ?? "");
      if (!address || !session) throw new Error("Phantom did not return an account");
      localStorage.setItem(
        K_SESS,
        JSON.stringify({ shared: bs58.encode(shared), session, address } satisfies TgSession),
      );
      localStorage.removeItem(K_PENDING);
      // Chain straight into the sign-in step (another round-trip).
      await startSignIn(address);
      return true;
    }

    const sess = load<TgSession>(K_SESS);
    if (!sess) throw new Error("Wallet session lost — reconnect");
    const shared = bs58.decode(sess.shared);
    const res = decrypt(data, nonce, shared);

    if (pending.kind === "sign") {
      const signature = String(res.signature ?? "");
      // Phantom returns a base58 signature; /auth/verify wants base64.
      const sigBytes = bs58.decode(signature);
      let bin = "";
      for (const b of sigBytes) bin += String.fromCharCode(b);
      const sigB64 = btoa(bin);
      const verifyRes = await fetch(`${SERVER_HTTP}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pubkey: pending.address, nonce: pending.nonce, signature: sigB64 }),
      });
      if (!verifyRes.ok) throw new Error("Signature rejected");
      const { session } = (await verifyRes.json()) as { session: string };
      localStorage.setItem(
        "bp_wallet",
        JSON.stringify({ address: pending.address, session, walletName: TG_WALLET_NAME }),
      );
      localStorage.removeItem(K_PENDING);
      h.onConnected(pending.address);
      return true;
    }

    if (pending.kind === "deposit") {
      localStorage.removeItem(K_PENDING);
      h.onDeposit(String(res.signature ?? ""));
      return true;
    }
    return false;
  } catch (e) {
    localStorage.removeItem(K_PENDING);
    h.onError((e as Error).message);
    return true;
  }
}

export function disconnectTelegramWallet(): void {
  localStorage.removeItem(K_SESS);
  localStorage.removeItem(K_PENDING);
}
