import { NextResponse } from "next/server";
import { TOKEN_MINT, TOKEN_TICKER, TOTAL_SUPPLY } from "@bomberpump/shared";

export const dynamic = "force-dynamic";

const CA = TOKEN_MINT; // single source of truth (shared)
const INITIAL_SUPPLY = TOTAL_SUPPLY;

export interface TokenData {
  price: number;
  marketCap: number;
  supply: number;
  burnedPct: number;
  symbol: string;
  priceChange24h: number;
}

interface PriceSource {
  price: number;
  marketCap: number;
  symbol: string;
  priceChange24h: number;
}

/* ── DexScreener — 5 s hard timeout, optional for pre-Ray tokens ───────── */
async function fetchDexScreener(): Promise<PriceSource | null> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${CA}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BomberMeme/1.0; +https://bombermeme.fun)",
      },
      signal: AbortSignal.timeout(5_000),
    }
  );
  if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
  const json = await res.json();
  const pair = json?.pairs?.[0];
  if (!pair) return null;
  return {
    price:          parseFloat(pair.priceUsd ?? "0"),
    marketCap:      (pair.marketCap ?? pair.fdv ?? 0) as number,
    symbol:         ((pair.baseToken?.symbol as string) ?? TOKEN_TICKER).trim(),
    priceChange24h: (pair.priceChange?.h24 ?? 0) as number,
  };
}

/* ── Pump.fun v3 fallback — authoritative for pre-Ray bonding curve tokens ─ */
async function fetchPumpFun(): Promise<PriceSource | null> {
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${CA}?sync=true`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://pump.fun/",
        Origin: "https://pump.fun",
      },
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const marketCap =
      Number(json?.usd_market_cap ?? json?.market_cap ?? json?.usdMarketCap ?? 0);
    const explicitPrice =
      Number(json?.price_usd ?? json?.usd_price ?? json?.priceUsd ?? 0);
    const totalSupply =
      Number(json?.total_supply_str ?? json?.total_supply ?? 0) / 1_000_000;
    const price = explicitPrice || (marketCap > 0 ? marketCap / (totalSupply || INITIAL_SUPPLY) : 0);
    return {
      price,
      marketCap,
      symbol: ((json?.symbol as string) ?? TOKEN_TICKER).trim() || TOKEN_TICKER,
      priceChange24h: 0,
    };
  } catch (err) {
    console.warn("[/api/token] Pump.fun fallback failed:", err);
    return null;
  }
}

/* ── Birdeye public fallback — optional third layer for raw price only ───── */
async function fetchBirdeye(): Promise<PriceSource | null> {
  try {
    const res = await fetch(`https://public-api.birdeye.so/public/price?address=${CA}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const price = Number(json?.data?.value ?? json?.value ?? json?.price ?? 0);
    if (!price) return null;
    return {
      price,
      marketCap: price * INITIAL_SUPPLY,
      symbol: TOKEN_TICKER,
      priceChange24h: 0,
    };
  } catch (err) {
    console.warn("[/api/token] Birdeye fallback failed:", err);
    return null;
  }
}

/* ── Solana RPC — both endpoints raced in parallel, 4 s each ────────────── */
async function fetchTokenSupply(): Promise<number> {
  const query = (rpc: string): Promise<number> =>
    fetch(rpc, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method:  "getTokenSupply",
        params:  [CA],
      }),
      signal: AbortSignal.timeout(4_000),
    })
    .then((r) => r.json())
    .then((j) => {
      const v = j?.result?.value?.uiAmount;
      if (typeof v !== "number") throw new Error("bad rpc response");
      return v;
    });

  // Race both RPCs simultaneously — first success wins, other is abandoned.
  // Worst-case wall-clock: max(4s, 4s) = 4s (vs. old sequential 4s + 4s = 8s).
  return Promise.any([
    query("https://api.mainnet-beta.solana.com"),
    query("https://solana-api.projectserum.com"),
  ]).catch(() => INITIAL_SUPPLY); // both failed → assume no burns
}

/* ── Route handler ──────────────────────────────────────────────────────── */
export async function GET() {
  try {
    // Total budget: max(5s DexScreener, 4s Pump.fun, 3s Birdeye, 4s RPC).
    // Even if Pump.fun is blocked, the route still returns a 200 with safe defaults.
    const [dex, pump, birdeye, currentSupply] = await Promise.all([
      fetchDexScreener().catch((err) => {
        console.warn("[/api/token] DexScreener unavailable:", err);
        return null;
      }),
      fetchPumpFun(),
      fetchBirdeye(),
      fetchTokenSupply(),
    ]);
    const source = dex ?? pump ?? birdeye;

    const burnedPct =
      currentSupply < INITIAL_SUPPLY
        ? ((INITIAL_SUPPLY - currentSupply) / INITIAL_SUPPLY) * 100
        : 0;

    const data: TokenData = {
      price:          source?.price ?? 0,
      marketCap:      source?.marketCap ?? 0,
      supply:         currentSupply,
      burnedPct,
      symbol:         source?.symbol ?? TOKEN_TICKER,
      priceChange24h: source?.priceChange24h ?? 0,
    };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/token] error:", message);
    // Never strand the widget in RETRYING for missing third-party data.
    return NextResponse.json(
      {
        price: 0,
        marketCap: 0,
        supply: INITIAL_SUPPLY,
        burnedPct: 0,
        symbol: TOKEN_TICKER,
        priceChange24h: 0,
        warning: message,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
