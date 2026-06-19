// Sign-In With Solana (lite): the client signs a server-issued nonce with the
// wallet's ed25519 key; we verify it and hand back an HMAC session bound to the
// wallet address. This proves wallet ownership without any on-chain transaction.

import { createHmac, randomBytes } from "node:crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";

const NONCE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 7 * 24 * 3600_000;
// Sessions are HMAC'd with this. It MUST be set (and identical across instances)
// in production — enforced by the preflight check in index.ts. If unset we fall
// back to an ephemeral per-process key (fine for local dev; every restart then
// invalidates all sessions, and multi-instance would reject each other's).
export const AUTH_SECRET_SET = (process.env.AUTH_SECRET ?? "").length >= 16;
const SECRET = process.env.AUTH_SECRET ?? randomBytes(32).toString("hex");

const nonces = new Map<string, number>(); // nonce -> expiry

/** Exact message the wallet is asked to sign. Must match the client byte-for-byte. */
export function messageFor(nonce: string): string {
  return `Bombermeme\nSign in to verify wallet ownership.\n\nNonce: ${nonce}`;
}

export function createNonce(): string {
  const n = randomBytes(16).toString("hex");
  nonces.set(n, Date.now() + NONCE_TTL_MS);
  return n;
}

/** Verify a base64 ed25519 signature of messageFor(nonce) by `pubkey` (base58). */
export function verifySignature(pubkey: string, nonce: string, signatureB64: string): boolean {
  const exp = nonces.get(nonce);
  if (!exp || Date.now() > exp) {
    nonces.delete(nonce);
    return false;
  }
  nonces.delete(nonce); // single use -> no replay
  let pk: Uint8Array;
  let sig: Uint8Array;
  try {
    pk = bs58.decode(pubkey);
    sig = new Uint8Array(Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
  if (pk.length !== 32 || sig.length !== 64) return false;
  const msg = new TextEncoder().encode(messageFor(nonce));
  try {
    return nacl.sign.detached.verify(msg, sig, pk);
  } catch {
    return false;
  }
}

export function createSession(pubkey: string): string {
  const payload = Buffer.from(JSON.stringify({ p: pubkey, e: Date.now() + SESSION_TTL_MS })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Returns the wallet address if the session is valid, else null. */
export function verifySession(token: string): string | null {
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig) return null;
  const expect = createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig !== expect) return null;
  try {
    const o = JSON.parse(Buffer.from(payload, "base64url").toString()) as { p: string; e: number };
    if (Date.now() > o.e) return null;
    return o.p;
  } catch {
    return null;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [n, e] of nonces) if (now > e) nonces.delete(n);
}, 60_000).unref?.();
