// Real pump.fun token integration (custodial, Model A).
//
// READS (no keys): a wallet's on-chain balance, for display/holder checks.
// CUSTODY (treasury key): deposits are watched on the treasury token account and
// credited to an off-chain balance; withdrawals are signed out of the treasury.
//
// All custody features are inert unless the treasury env vars are set:
//   TREASURY_ADDRESS  - public key that receives deposits (required for deposits)
//   TREASURY_SECRET   - base58 secret key, signs withdrawals (required to cash out)
//   SOLANA_RPC        - an RPC that supports tx submission (Ankr/SolanaTracker/etc)
//
// SECRETS NEVER LIVE IN THE REPO — only in the host's env.

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  type ParsedInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";
import { TOKEN_MINT, TOKEN_DECIMALS, HOLDER_MIN } from "@bomberpump/shared";
import { store } from "./store.js";

// Default to the public mainnet RPC (rate-limited but keyless). For anything
// real, set SOLANA_RPC to a provider with a key (Helius/QuickNode/Alchemy).
const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC, "confirmed");
const MINT = new PublicKey(TOKEN_MINT);

const treasuryKeypair = process.env.TREASURY_SECRET
  ? Keypair.fromSecretKey(bs58.decode(process.env.TREASURY_SECRET.trim()))
  : null;
const treasuryPubkey = process.env.TREASURY_ADDRESS
  ? new PublicKey(process.env.TREASURY_ADDRESS.trim())
  : treasuryKeypair?.publicKey ?? null;
const treasuryAta = treasuryPubkey ? getAssociatedTokenAddressSync(MINT, treasuryPubkey, true) : null;

export const TREASURY_ADDRESS = treasuryPubkey?.toBase58() ?? "";
export const depositsEnabled = !!treasuryAta;
export const withdrawalsEnabled = !!treasuryKeypair && !!treasuryAta;

const POW = 10 ** TOKEN_DECIMALS;
export const toBaseUnits = (whole: number): number => Math.round(whole * POW);
export const fromBaseUnits = (base: number): number => base / POW;

// --- read-only balance (display / holder gating) ---------------------------
const TTL_MS = 60_000;
const cache = new Map<string, { balance: number; at: number }>();

/** A wallet's total on-chain balance of TOKEN_MINT (ui amount), cached. */
export async function tokenBalance(wallet: string): Promise<number> {
  if (!wallet) return 0;
  const hit = cache.get(wallet);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.balance;
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [wallet, { mint: TOKEN_MINT }, { encoding: "jsonParsed" }],
      }),
    });
    const j = (await res.json()) as {
      result?: { value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } } } }> };
    };
    let balance = 0;
    for (const acc of j.result?.value ?? []) {
      balance += acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    }
    cache.set(wallet, { balance, at: Date.now() });
    return balance;
  } catch (e) {
    console.error("[token] balance read failed", e);
    return hit?.balance ?? 0; // serve stale on error, never block
  }
}

export async function isHolder(wallet: string): Promise<boolean> {
  return (await tokenBalance(wallet)) >= HOLDER_MIN;
}

// --- deposit watcher -------------------------------------------------------
const seenSigs = new Set<string>();

/** Poll the treasury token account for incoming transfers and credit senders. */
export function startDepositWatcher(): void {
  if (!treasuryAta) {
    console.log("[token] deposits disabled (set TREASURY_ADDRESS to enable)");
    return;
  }
  console.log(`[token] watching deposits to ${TREASURY_ADDRESS} (${treasuryAta.toBase58()})`);
  setInterval(() => void rescanDeposits(), 15_000);
  void rescanDeposits();
}

let scanning = false;
let lastScanAt = 0;

/** Scan recent treasury transfers and credit any not-yet-credited deposits.
 *  Safe to call repeatedly (DB dedupe by signature). Called on a timer and on
 *  demand when a player opens the Bank. */
export async function rescanDeposits(): Promise<void> {
  if (!treasuryAta || scanning) return;
  scanning = true;
  try {
    // Scan deep enough that a deposit can't scroll out of the window.
    const sigs = await connection.getSignaturesForAddress(treasuryAta, { limit: 100 });
    for (const { signature, err } of sigs) {
      if (err || seenSigs.has(signature)) continue;
      // Only mark a signature "seen" once we actually fetched & inspected it —
      // a transient RPC failure must be retried, not silently skipped forever.
      const fetched = await creditFromTx(signature);
      if (fetched) seenSigs.add(signature);
    }
    if (seenSigs.size > 5000) seenSigs.clear(); // bound memory; DB dedupe is the truth
    lastScanAt = Date.now();
  } catch (e) {
    console.error("[token] deposit scan failed", e);
  } finally {
    scanning = false;
  }
}

/** Debounced on-demand rescan (e.g. when a player opens the Bank). */
export function rescanDepositsSoon(): void {
  if (Date.now() - lastScanAt > 4000) void rescanDeposits();
}

/** Inspect one tx and credit any transfer into the treasury. Returns true if
 *  the tx was fetched (so the caller can stop re-checking it), false on a
 *  fetch failure (so it gets retried). */
async function creditFromTx(signature: string): Promise<boolean> {
  let tx;
  try {
    tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
  } catch (e) {
    console.error("[token] getParsedTransaction failed", signature, e);
    return false; // retry next scan
  }
  if (!tx) return false; // not available yet -> retry
  const instrs: ParsedInstruction[] = [
    ...(tx.transaction.message.instructions as ParsedInstruction[]),
    ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions as ParsedInstruction[]),
  ];
  let foundDeposit = false;
  for (const ix of instrs) {
    if (!("parsed" in ix) || ix.program !== "spl-token") continue;
    const info = (ix.parsed as { type?: string; info?: Record<string, unknown> })?.info;
    const type = (ix.parsed as { type?: string })?.type;
    if (!info || (type !== "transfer" && type !== "transferChecked")) continue;
    if (info.destination !== treasuryAta!.toBase58()) continue;
    const sender = String(info.authority ?? info.owner ?? "");
    const amount =
      type === "transferChecked"
        ? Number((info.tokenAmount as { amount?: string })?.amount ?? 0)
        : Number(info.amount ?? 0);
    if (!sender || amount <= 0) continue;
    foundDeposit = true;
    const credited = await store.creditDeposit(signature, sender, amount);
    if (credited) {
      cache.delete(sender);
      console.log(`[token] deposit credited: ${fromBaseUnits(amount)} to ${sender} (${signature})`);
    }
  }
  if (!foundDeposit) console.log(`[token] tx ${signature} has no $token transfer into treasury (skipped)`);
  return true; // fetched & inspected
}

// --- withdraw (signs out of the treasury) ----------------------------------
/** Debit the off-chain balance and send the tokens on-chain to the wallet.
 *  Refunds the off-chain balance if the transfer fails. Returns the signature. */
export async function withdraw(wallet: string, amountBase: number): Promise<string> {
  if (!treasuryKeypair || !treasuryAta) throw new Error("withdrawals_disabled");
  if (!Number.isInteger(amountBase) || amountBase <= 0) throw new Error("bad_amount");

  const owner = new PublicKey(wallet); // throws on a malformed address
  const after = await store.adjustToken(wallet, -amountBase);
  if (after === null) throw new Error("insufficient_balance");

  try {
    const destAta = await getOrCreateAssociatedTokenAccount(connection, treasuryKeypair, MINT, owner);
    const ix = createTransferInstruction(treasuryAta, destAta.address, treasuryKeypair.publicKey, amountBase);
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [treasuryKeypair]);
    cache.delete(wallet);
    console.log(`[token] withdraw ${fromBaseUnits(amountBase)} to ${wallet} (${sig})`);
    return sig;
  } catch (e) {
    await store.adjustToken(wallet, amountBase); // refund on failure
    console.error("[token] withdraw failed, refunded", e);
    throw new Error("withdraw_failed");
  }
}
