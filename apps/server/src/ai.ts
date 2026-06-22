// AI analyst — sends a unified metrics snapshot (business + game + technical) to
// an LLM and returns a concise, prioritized, data-driven brief for the admin
// control centre. Provider-agnostic (WaveSpeed / Anthropic / OpenAI) and a hard
// no-op when no key is configured, so it never affects the running game.
//
// Env (any one key enables it):
//   BOMBER_ADMIN  — WaveSpeed API key (preferred here) → provider defaults to wavespeed
//   AI_API_KEY    — generic key (for anthropic/openai)
//   AI_PROVIDER   — "wavespeed" (default when BOMBER_ADMIN set) | "anthropic" | "openai"
//   AI_MODEL      — model id (default per provider; wavespeed → moonshotai/kimi-k2.6)
//   WAVESPEED_BASE— override the WaveSpeed API base (default https://api.wavespeed.ai/api/v3)

const WAVESPEED_KEY = process.env.BOMBER_ADMIN ?? "";
const KEY = process.env.AI_API_KEY || WAVESPEED_KEY || "";
const PROVIDER = (process.env.AI_PROVIDER ?? (WAVESPEED_KEY ? "wavespeed" : "anthropic")).toLowerCase();
const MODEL =
  process.env.AI_MODEL ??
  (PROVIDER === "wavespeed"
    ? "moonshotai/kimi-k2.6"
    : PROVIDER === "openai"
      ? "gpt-4o-mini"
      : "claude-haiku-4-5-20251001");
const WAVESPEED_BASE = process.env.WAVESPEED_BASE ?? "https://api.wavespeed.ai/api/v3";

export function aiConfigured(): boolean {
  return !!KEY;
}
export function aiInfo(): { provider: string; model: string; configured: boolean } {
  return { provider: PROVIDER, model: MODEL, configured: !!KEY };
}

// The analyst's standing brief — defines its lens AND its working cycle so every
// run is consistent and actionable (not generic commentary).
const SYSTEM_PROMPT = `You are the lead growth & ops analyst for BomberMeme.fun — a realtime multiplayer
web game (Bomberman-style) where players stake a Solana memecoin ($BGDF) and free "chips".
You receive ONE JSON snapshot per run that fuses BUSINESS, GAME, and TECHNICAL metrics from
the live admin dashboard.

Your job: turn raw numbers into decisions that grow and protect the project.

Work cycle every run:
1) READ the whole snapshot; note the timestamp and that values are "today" (UTC) or "since boot/restart" where labelled.
2) DIAGNOSE across three lenses together:
   - Business: deposits/withdrawals (net treasury flow), rake %, paying players vs target, referral health (network size, unattached, earnings).
   - Game: online, in-match, rooms, matches today, bots vs humans, Lucky Spin net chip sink, top players.
   - Technical: server tick load vs budget (saturation = lost players), memory, uptime, error count + recent errors, store durability, WS sockets.
3) CORRELATE: explain WHY a number is what it is using OTHER numbers (e.g. low matches + high tick load = capacity shedding; deposits up but withdrawals higher = treasury bleeding; spins net-positive = chip inflation).
4) PRIORITIZE by impact × confidence.

Output (Markdown, tight, no fluff):
- **Verdict:** one line — healthy / watch / at-risk, with the single most important number.
- **Key signals (3–6):** each = the metric + value + what it means.
- **Risks / anomalies:** technical, economic, and gameplay — only real ones, cite the number.
- **Do next (top 3):** concrete, prioritized actions with the expected effect; mark anything that needs a config/env change.
Always cite the actual numbers. If a critical metric is zero/missing, say so and what to check. Be honest about uncertainty.`;

export interface AiResult {
  ok: boolean;
  text?: string;
  reason?: string;
  model?: string;
  provider?: string;
}

export async function aiAnalyze(snapshot: unknown): Promise<AiResult> {
  if (!KEY)
    return {
      ok: false,
      reason: "AI not configured — set BOMBER_ADMIN (WaveSpeed) or AI_API_KEY.",
      provider: PROVIDER,
      model: MODEL,
    };
  const user = "Here is the live snapshot. Run your analysis.\n\n```json\n" + JSON.stringify(snapshot, null, 2) + "\n```";
  try {
    let text: string;
    if (PROVIDER === "wavespeed") text = await callWaveSpeed(user);
    else if (PROVIDER === "openai") text = await callOpenAi(user);
    else text = await callAnthropic(user);
    if (!text) return { ok: false, reason: "AI returned an empty response.", provider: PROVIDER, model: MODEL };
    return { ok: true, text, model: MODEL, provider: PROVIDER };
  } catch (e) {
    return { ok: false, reason: `AI request failed: ${String(e)}`, provider: PROVIDER, model: MODEL };
  }
}

// ---- WaveSpeed (async predictions v3) ----
// Submit the prompt, then poll the result endpoint. Response shapes vary by
// model, so we extract text defensively from the common fields.
function pickText(j: unknown): string {
  const any = j as Record<string, unknown>;
  const d = (any?.data ?? any) as Record<string, unknown>;
  const fromOutputs = (o: unknown): string => {
    if (typeof o === "string") return o;
    if (Array.isArray(o)) return o.filter((x) => typeof x === "string").join("\n");
    return "";
  };
  return (
    fromOutputs(d?.outputs) ||
    fromOutputs((d as { output?: unknown })?.output) ||
    (typeof d?.text === "string" ? (d.text as string) : "") ||
    // OpenAI-compatible fallback some gateways return
    (((d as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content) ?? "")
  ).trim();
}

async function callWaveSpeed(user: string): Promise<string> {
  const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
  const submit = await fetch(`${WAVESPEED_BASE}/${MODEL}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: `${SYSTEM_PROMPT}\n\n---\n\n${user}`,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
      max_tokens: 1400,
      temperature: 0.4,
    }),
  });
  const sj = (await submit.json().catch(() => ({}))) as Record<string, unknown>;
  if (!submit.ok) throw new Error(`wavespeed ${submit.status}: ${JSON.stringify(sj).slice(0, 400)}`);
  // Some models answer synchronously.
  const immediate = pickText(sj);
  if (immediate) return immediate;
  // Otherwise it's an async prediction — poll for the result.
  const id = ((sj.data as { id?: string })?.id ?? (sj as { id?: string }).id) as string | undefined;
  if (!id) throw new Error(`wavespeed: no text and no prediction id in ${JSON.stringify(sj).slice(0, 400)}`);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const r = await fetch(`${WAVESPEED_BASE}/predictions/${id}/result`, { headers });
    const rj = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    const d = (rj.data ?? rj) as Record<string, unknown>;
    const status = String(d?.status ?? "");
    if (status === "completed" || status === "succeeded" || status === "success") {
      const t = pickText(rj);
      if (t) return t;
      throw new Error(`wavespeed completed but no text: ${JSON.stringify(rj).slice(0, 400)}`);
    }
    if (status === "failed" || status === "error") throw new Error(`wavespeed failed: ${JSON.stringify(d).slice(0, 400)}`);
  }
  throw new Error("wavespeed: timed out waiting for the result");
}

async function callAnthropic(user: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = (await r.json()) as { content?: Array<{ type: string; text?: string }> };
  return (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();
}

async function callOpenAi(user: string): Promise<string> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (j.choices?.[0]?.message?.content ?? "").trim();
}
