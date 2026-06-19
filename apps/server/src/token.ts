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
  type ParsedInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { TOKEN_MINT, TOKEN_DECIMALS, HOLDER_MIN } from "@bomberpump/shared";
import { store } from "./store.js";
import { analytics } from "./analytics.js";
import { logEvent, shortWallet } from "./events.js";
import { alert } from "./alert.js";
import { metrics } from "./metrics.js";

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

// The mint may be a classic SPL token OR Token-2022 — they use different
// program ids and therefore different associated-token-account addresses. We
// detect the real one at startup; until then assume classic.
let tokenProgram = TOKEN_PROGRAM_ID;
let mintDecimals = TOKEN_DECIMALS;
let treasuryAta = treasuryPubkey
  ? getAssociatedTokenAddressSync(MINT, treasuryPubkey, true, tokenProgram)
  : null;

export const TREASURY_ADDRESS = treasuryPubkey?.toBase58() ?? "";
export const depositsEnabled = !!treasuryPubkey;
export const withdrawalsEnabled = !!treasuryKeypair && !!treasuryPubkey;

export const toBaseUnits = (whole: number): number => Math.round(whole * 10 ** mintDecimals);
export const fromBaseUnits = (base: number): number => base / 10 ** mintDecimals;

let inited = false;
/** Detect the mint's token program (classic vs Token-2022) + decimals, and
 *  recompute the treasury ATA for that program. Idempotent. */
async function initToken(): Promise<void> {
  if (inited) return;
  inited = true;
  try {
    const info = await connection.getParsedAccountInfo(MINT);
    const owner = info.value?.owner;
    if (owner && owner.equals(TOKEN_2022_PROGRAM_ID)) tokenProgram = TOKEN_2022_PROGRAM_ID;
    const data = info.value?.data;
    if (data && typeof data === "object" && "parsed" in data) {
      const dec = (data.parsed as { info?: { decimals?: number } })?.info?.decimals;
      if (Number.isFinite(dec)) mintDecimals = dec as number;
    }
    if (treasuryPubkey) {
      treasuryAta = getAssociatedTokenAddressSync(MINT, treasuryPubkey, true, tokenProgram);
    }
    console.log(
      `[token] mint program=${tokenProgram.equals(TOKEN_2022_PROGRAM_ID) ? "token-2022" : "spl-token"}` +
        ` decimals=${mintDecimals} treasuryAta=${treasuryAta?.toBase58() ?? "-"}`,
    );
  } catch (e) {
    inited = false; // allow retry on a transient RPC failure
    console.error("[token] initToken failed (will retry)", e);
  }
}

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

// --- USD price (Dexscreener, keyless, cached) ------------------------------
let priceUsd = 0;
let priceAt = 0;
/** USD price of one whole token (0 if unknown). Cached ~60s. */
export async function tokenPriceUsd(): Promise<number> {
  if (Date.now() - priceAt < 60_000) return priceUsd;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_MINT}`);
    const j = (await res.json()) as { pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }> };
    const pairs = (j.pairs ?? []).filter((p) => p.priceUsd);
    // Pick the deepest-liquidity pair for a sane price.
    pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const p = Number(pairs[0]?.priceUsd ?? 0);
    if (Number.isFinite(p) && p > 0) {
      priceUsd = p;
      priceAt = Date.now();
    }
  } catch (e) {
    console.error("[token] price fetch failed", e);
  }
  return priceUsd;
}

// --- deposit watcher -------------------------------------------------------
const seenSigs = new Set<string>();

/** Poll the treasury token account for incoming transfers and credit senders. */
export async function startDepositWatcher(): Promise<void> {
  if (!treasuryPubkey) {
    console.log("[token] deposits disabled (set TREASURY_ADDRESS to enable)");
    return;
  }
  await initToken();
  console.log(`[token] watching deposits to ${TREASURY_ADDRESS} (${treasuryAta?.toBase58()})`);
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
  if (tx.meta?.err) return true; // failed tx — fetched, never credit it
  const instrs: ParsedInstruction[] = [
    ...(tx.transaction.message.instructions as ParsedInstruction[]),
    ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions as ParsedInstruction[]),
  ];
  let foundDeposit = false;
  for (const ix of instrs) {
    if (!("parsed" in ix) || (ix.program !== "spl-token" && ix.program !== "spl-token-2022")) continue;
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
      analytics.depositCredited(sender, fromBaseUnits(amount));
      logEvent("⬇️", `${shortWallet(sender)} deposited ${fromBaseUnits(amount).toLocaleString()}`);
      metrics.deposit(sender, fromBaseUnits(amount));
      console.log(`[token] deposit credited: ${fromBaseUnits(amount)} to ${sender} (${signature})`);
    }
  }
  if (!foundDeposit) console.log(`[token] tx ${signature} has no $token transfer into treasury (skipped)`);
  return true; // fetched & inspected
}

/** Credit a single deposit by its transaction signature (user-initiated claim).
 *  Returns which wallet it credited and how much, or a reason it couldn't. */
export async function claimBySignature(
  signature: string,
  expectedWallet?: string,
): Promise<{
  ok: boolean;
  wallet?: string;
  amount?: number;
  already?: boolean;
  reason?: string;
}> {
  await initToken();
  if (!treasuryAta) return { ok: false, reason: "deposits_disabled" };
  let tx;
  try {
    tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
  } catch {
    return { ok: false, reason: "rpc_error" };
  }
  if (!tx) return { ok: false, reason: "tx_not_found" };
  if (tx.meta?.err) return { ok: false, reason: "tx_failed" };
  const instrs: ParsedInstruction[] = [
    ...(tx.transaction.message.instructions as ParsedInstruction[]),
    ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions as ParsedInstruction[]),
  ];
  const seen: string[] = [];
  let dbg = "";
  for (const ix of instrs) {
    if (!("parsed" in ix) || (ix.program !== "spl-token" && ix.program !== "spl-token-2022")) continue;
    const p = ix.parsed as { type?: string; info?: Record<string, unknown> };
    const info = p?.info;
    const type = p?.type;
    if (!info || (type !== "transfer" && type !== "transferChecked")) continue;
    if (typeof info.destination === "string") seen.push(info.destination);
    if (info.destination !== treasuryAta.toBase58()) continue;
    const sender = String(info.authority ?? info.owner ?? info.multisigAuthority ?? "");
    const ta = info.tokenAmount as { amount?: string } | undefined;
    const amount = Number(ta?.amount ?? info.amount ?? 0);
    dbg = `type=${type} sender=${sender || "?"} amount=${amount} keys=${Object.keys(info).join(",")}`;
    if (!sender || !Number.isFinite(amount) || amount <= 0) continue;
    // If a caller is claiming, only credit a deposit THEY sent (no crediting
    // arbitrary wallets, and ties the RPC cost to an authenticated user).
    if (expectedWallet && sender !== expectedWallet) continue;
    const credited = await store.creditDeposit(signature, sender, amount);
    if (credited) {
      cache.delete(sender);
      analytics.depositCredited(sender, fromBaseUnits(amount));
      logEvent("⬇️", `${shortWallet(sender)} deposited ${fromBaseUnits(amount).toLocaleString()}`);
      metrics.deposit(sender, fromBaseUnits(amount));
    }
    return { ok: true, wallet: sender, amount: fromBaseUnits(amount), already: !credited };
  }
  // Server-side detail for logs only — never leak treasury/tx internals to clients.
  if (dbg) console.warn("[token] claim matched no creditable transfer", signature, "seen=", seen, dbg);
  return { ok: false, reason: expectedWallet ? "not_your_deposit" : "no_token_transfer_to_treasury" };
}

// --- deposit (server builds it, the player's wallet signs & sends) ----------
/** Build an UNSIGNED transfer of `amountBase` tokens from the player's wallet
 *  to the treasury. Returned base64 is handed to the wallet to sign+send, so we
 *  never need crypto libs (or the user's key) in the browser. */
export async function buildDepositTx(wallet: string, amountBase: number): Promise<string> {
  await initToken();
  if (!treasuryAta) throw new Error("deposits_disabled");
  if (!Number.isInteger(amountBase) || amountBase <= 0) throw new Error("bad_amount");
  const owner = new PublicKey(wallet);
  const sourceAta = getAssociatedTokenAddressSync(MINT, owner, false, tokenProgram);
  const ix = createTransferCheckedInstruction(
    sourceAta,
    MINT,
    treasuryAta,
    owner,
    amountBase,
    mintDecimals,
    [],
    tokenProgram,
  );
  const { blockhash } = await connection.getLatestBlockhash("finalized");
  const tx = new Transaction().add(ix);
  tx.feePayer = owner;
  tx.recentBlockhash = blockhash;
  return Buffer.from(tx.serialize({ requireAllSignatures: false, verifySignatures: false })).toString("base64");
}

// --- withdraw (signs out of the treasury) ----------------------------------
const withdrawInFlight = new Set<string>(); // serialize withdrawals per wallet

/** Debit the off-chain balance and send the tokens on-chain to the wallet.
 *  Refunds the off-chain balance ONLY if we can prove the transfer never landed
 *  (refunding a tx that actually went through would be a double-payout). */
export async function withdraw(wallet: string, amountBase: number): Promise<string> {
  await initToken();
  if (!treasuryKeypair || !treasuryAta) throw new Error("withdrawals_disabled");
  if (!Number.isInteger(amountBase) || amountBase <= 0) throw new Error("bad_amount");
  if (withdrawInFlight.has(wallet)) throw new Error("withdraw_in_progress");
  withdrawInFlight.add(wallet);
  try {
    const owner = new PublicKey(wallet); // throws on a malformed address
    const after = await store.adjustToken(wallet, -amountBase); // atomic, overdraw-safe
    if (after === null) throw new Error("insufficient_balance");

    let sig: string | undefined;
    try {
      const destAta = await getOrCreateAssociatedTokenAccount(
        connection,
        treasuryKeypair,
        MINT,
        owner,
        false,
        undefined,
        undefined,
        tokenProgram,
      );
      const ix = createTransferInstruction(
        treasuryAta,
        destAta.address,
        treasuryKeypair.publicKey,
        amountBase,
        [],
        tokenProgram,
      );
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction().add(ix);
      tx.feePayer = treasuryKeypair.publicKey;
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.sign(treasuryKeypair);
      // Send first so we capture the signature, then confirm separately — that
      // way a confirmation timeout doesn't lose track of a tx that may have landed.
      sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 5 });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      cache.delete(wallet);
      analytics.withdrawal(wallet, fromBaseUnits(amountBase));
      logEvent("⬆️", `${shortWallet(wallet)} withdrew ${fromBaseUnits(amountBase).toLocaleString()}`);
      console.log(`[token] withdraw ${fromBaseUnits(amountBase)} to ${wallet} (${sig})`);
      return sig;
    } catch (e) {
      // The transfer errored. If we have a signature it MIGHT still have landed —
      // never refund a withdrawal that actually went through.
      if (sig) {
        try {
          const st = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
          const v = st.value;
          if (v && !v.err && (v.confirmationStatus === "confirmed" || v.confirmationStatus === "finalized")) {
            console.warn("[token] withdraw confirm errored but tx landed; keeping debit", sig);
            return sig;
          }
          if (v && !v.err) {
            // Seen but not yet confirmed — status unknown. Do NOT refund (avoid
            // double-pay); flag for manual reconciliation.
            alert(`withdraw UNCERTAIN ${fromBaseUnits(amountBase)} to ${shortWallet(wallet)} sig=${sig} — NOT refunded, check manually`);
            throw new Error("withdraw_pending");
          }
        } catch (e2) {
          if ((e2 as Error).message === "withdraw_pending") throw e2;
          alert(`withdraw status check failed for ${shortWallet(wallet)} sig=${sig} — NOT refunded, check manually`);
          throw new Error("withdraw_pending");
        }
      }
      // Definitively never sent / failed before broadcast → safe to refund.
      await store.adjustToken(wallet, amountBase);
      alert(`withdraw failed (refunded) ${fromBaseUnits(amountBase)} to ${shortWallet(wallet)}: ${(e as Error).message}`);
      throw new Error("withdraw_failed");
    }
  } finally {
    withdrawInFlight.delete(wallet);
  }
}
