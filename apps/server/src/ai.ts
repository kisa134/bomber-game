// AI analyst — sends a unified metrics snapshot (business + game + technical) to
// an LLM and returns a concise, prioritized, data-driven analysis for the admin
// control centre. Provider-agnostic (Anthropic or OpenAI), and a hard no-op when
// no key is configured, so it never affects the running game.
//
// Env:
//   AI_API_KEY   — required to enable (else returns {ok:false})
//   AI_PROVIDER  — "anthropic" (default) | "openai"
//   AI_MODEL     — model id (sensible per-provider default)

const KEY = process.env.AI_API_KEY ?? "";
const PROVIDER = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
const MODEL =
  process.env.AI_MODEL ?? (PROVIDER === "openai" ? "gpt-4o-mini" : "claude-haiku-4-5-20251001");

export function aiConfigured(): boolean {
  return !!KEY;
}

const SYSTEM_PROMPT =
  "You are a senior analyst for BomberMeme.fun, a realtime multiplayer crypto game " +
  "(Solana memecoin stakes + free chips). You are given ONE JSON snapshot mixing " +
  "business, game, and technical metrics. Analyze them TOGETHER and produce a short, " +
  "punchy, data-driven brief for the founders. Structure: (1) one-line health verdict; " +
  "(2) 3-6 key signals with the numbers that justify them; (3) anomalies / risks " +
  "(technical: tick load, memory, errors; economic: rake, deposits, withdrawals, " +
  "referral health; gameplay: online, matches, retention proxies); (4) 3 concrete, " +
  "prioritized next actions. Be specific, cite the numbers, avoid fluff. Markdown.";

export interface AiResult {
  ok: boolean;
  text?: string;
  reason?: string;
  model?: string;
}

export async function aiAnalyze(snapshot: unknown): Promise<AiResult> {
  if (!KEY) return { ok: false, reason: "AI not configured — set AI_API_KEY (and optionally AI_PROVIDER / AI_MODEL)." };
  const user = "Here is the live snapshot. Analyze it.\n\n```json\n" + JSON.stringify(snapshot, null, 2) + "\n```";
  try {
    const text = PROVIDER === "openai" ? await callOpenAi(user) : await callAnthropic(user);
    if (!text) return { ok: false, reason: "AI returned an empty response." };
    return { ok: true, text, model: MODEL };
  } catch (e) {
    return { ok: false, reason: `AI request failed: ${String(e)}` };
  }
}

async function callAnthropic(user: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
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
      max_tokens: 1200,
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
