// Read-only on-chain reads for the real pump.fun token. No keys, no custody:
// we only query a wallet's SPL balance via JSON-RPC (cached) so the game can
// show holdings and (optionally) gate access. Wagering/custody is separate.

import { TOKEN_MINT, HOLDER_MIN } from "@bomberpump/shared";

const RPC = process.env.SOLANA_RPC || "https://rpc.ankr.com/solana";
const TTL_MS = 60_000;
const cache = new Map<string, { balance: number; at: number }>();

/** A wallet's total balance of TOKEN_MINT (ui amount), cached for a minute. */
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
