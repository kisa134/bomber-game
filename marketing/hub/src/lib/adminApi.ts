// Real admin data layer — talks to the game server's token-gated /admin/* API.
// The hub is served at /admin/marketing on the SAME origin, so these are
// same-origin fetches. NO mock data: every value here is the live project state.
import { useEffect, useRef, useState } from "react";

const TOKEN_KEY = "bp_admin_token";
export const getToken = (): string => localStorage.getItem(TOKEN_KEY) || "";
export const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t.trim());
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

/** GET an admin endpoint with the stored token. Returns parsed JSON or throws. */
export async function adminGet<T = any>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ token: getToken(), ...params }).toString();
  const r = await fetch(`${path}?${qs}`, { cache: "no-store" });
  if (r.status === 401) throw new Error("unauthorized");
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json() as Promise<T>;
}

/** POST an admin endpoint with the stored token in the query (matches server). */
export async function adminPost<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`${path}?token=${encodeURIComponent(getToken())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json().catch(() => ({})) as Promise<T>;
}

/** Poll /admin/stats every `ms`. Returns {data, error, loading}. */
export function useStats(ms = 5000): { data: any; error: string; loading: boolean } {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const d = await adminGet("/admin/stats");
        if (alive) { setData(d); setError(""); setLoading(false); }
      } catch (e) {
        if (alive) { setError(String((e as Error).message)); setLoading(false); }
      }
    };
    void tick();
    timer.current = setInterval(tick, ms);
    return () => { alive = false; if (timer.current) clearInterval(timer.current); };
  }, [ms]);
  return { data, error, loading };
}

/** One-shot fetch hook with manual refresh. */
export function useAdmin<T = any>(path: string, params: Record<string, string> = {}, deps: unknown[] = []): { data: T | null; error: string; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminGet<T>(path, params)
      .then((d) => { if (alive) { setData(d); setError(""); } })
      .catch((e) => { if (alive) setError(String((e as Error).message)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);
  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}

// --- formatting helpers -----------------------------------------------------
export const fmt = (n: number | undefined | null): string => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
export const fmtC = (n: number | undefined | null): string => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
};
export const shortWallet = (w?: string): string => (w ? `${w.slice(0, 4)}…${w.slice(-4)}` : "—");
