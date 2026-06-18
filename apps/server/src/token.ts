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
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { TOKEN_MINT, TOKEN_DECIMALS, HOLDER_MIN } from "@bomberpump/shared";
import { store } from "./store.js";
import { analytics } from "./analytics.js";
import { logEvent, shortWallet } from "./events.js";
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
): Promise<{
  ok: boolean;
  wallet?: string;
  amount?: number;
  already?: boolean;
  reason?: string;
  expected?: string;
  seen?: string[];
  debug?: string;
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
    const credited = await store.creditDeposit(signature, sender, amount);
    if (credited) {
      cache.delete(sender);
      analytics.depositCredited(sender, fromBaseUnits(amount));
      logEvent("⬇️", `${shortWallet(sender)} deposited ${fromBaseUnits(amount).toLocaleString()}`);
      metrics.deposit(sender, fromBaseUnits(amount));
    }
    return { ok: true, wallet: sender, amount: fromBaseUnits(amount), already: !credited };
  }
  return {
    ok: false,
    reason: dbg ? "matched_but_unparsed" : "no_token_transfer_to_treasury",
    expected: treasuryAta.toBase58(),
    seen,
    debug: dbg,
  };
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
/** Debit the off-chain balance and send the tokens on-chain to the wallet.
 *  Refunds the off-chain balance if the transfer fails. Returns the signature. */
export async function withdraw(wallet: string, amountBase: number): Promise<string> {
  await initToken();
  if (!treasuryKeypair || !treasuryAta) throw new Error("withdrawals_disabled");
  if (!Number.isInteger(amountBase) || amountBase <= 0) throw new Error("bad_amount");

  const owner = new PublicKey(wallet); // throws on a malformed address
  const after = await store.adjustToken(wallet, -amountBase);
  if (after === null) throw new Error("insufficient_balance");

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
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [treasuryKeypair]);
    cache.delete(wallet);
    analytics.withdrawal(wallet, fromBaseUnits(amountBase));
    logEvent("⬆️", `${shortWallet(wallet)} withdrew ${fromBaseUnits(amountBase).toLocaleString()}`);
    console.log(`[token] withdraw ${fromBaseUnits(amountBase)} to ${wallet} (${sig})`);
    return sig;
  } catch (e) {
    await store.adjustToken(wallet, amountBase); // refund on failure
    console.error("[token] withdraw failed, refunded", e);
    throw new Error("withdraw_failed");
  }
}
