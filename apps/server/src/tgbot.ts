// Telegram bot: on /start, send a welcome post + a "Play" button that opens the
// game as a Mini App, plus optional social/site link buttons. Disabled (no-op)
// until TG_BOT_TOKEN is set, so the server runs fine without it.

const TOKEN = process.env.TG_BOT_TOKEN ?? "";
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : "";
const WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET ?? "bombermeme-webhook";
const PUBLIC_URL = (process.env.PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL ?? "https://bomberpump.onrender.com").replace(/\/+$/, "");
const APP_URL = PUBLIC_URL; // the Mini App is the game, served at the same origin

async function tg(method: string, params: unknown): Promise<void> {
  if (!API) return;
  try {
    await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    // best-effort; never throw into the request path
  }
}

const WELCOME =
  "💣 <b>Bomberpump</b> — fast browser bomberman for the pump.fun crowd.\n\n" +
  "Drop bombs, blow up your rivals, grab power-ups and win the pot. 2–4 players, " +
  "instant matches, right inside Telegram.\n\n" +
  "— — —\n\n" +
  "💣 <b>Bomberpump</b> — быстрый браузерный бомбермен.\n\n" +
  "Ставь бомбы, взрывай соперников, собирай бонусы и забирай банк. 2–4 игрока, " +
  "мгновенные матчи — прямо в Telegram.\n\n" +
  "👇 Play / Играть";

interface Btn {
  text: string;
  url?: string;
  web_app?: { url: string };
}

// Launch link for the Mini App. A t.me deep link is the most robust "open the
// app" button — it never makes sendMessage fail (unlike an inline web_app button
// when the Mini App domain isn't registered). Falls back to a web_app button.
const BOT_NAME = process.env.TG_BOT ?? "";
const APP_NAME = process.env.TG_APP ?? "";
const PLAY_URL = BOT_NAME ? `https://t.me/${APP_NAME ? `${BOT_NAME}/${APP_NAME}` : BOT_NAME}?startapp=play` : "";

function keyboard(): { inline_keyboard: Btn[][] } {
  const play: Btn = PLAY_URL
    ? { text: "🎮 Play / Играть", url: PLAY_URL }
    : { text: "🎮 Play / Играть", web_app: { url: APP_URL } };
  const rows: Btn[][] = [[play]];
  // Optional social/site buttons — only shown when their env URL is set.
  const links: Array<[string | undefined, string]> = [
    [process.env.TG_LINK_SITE, "🌐 Website"],
    [process.env.TG_LINK_X, "𝕏 Twitter"],
    [process.env.TG_LINK_PUMP, "💊 pump.fun"],
    [process.env.TG_LINK_CHAT, "💬 Community"],
  ];
  const row = links.filter(([u]) => !!u).map(([u, text]) => ({ text, url: u! }));
  if (row.length) rows.push(row);
  return { inline_keyboard: rows };
}

/** Handle one Telegram update. Replies to /start, /play, /help with the post. */
export async function handleTgUpdate(update: unknown): Promise<void> {
  const msg = (update as { message?: { text?: string; chat?: { id?: number } } })?.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text ?? "";
  if (!chatId) return;
  if (/^\/(start|play|help)\b/.test(text)) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: WELCOME,
      parse_mode: "HTML",
      reply_markup: keyboard(),
      disable_web_page_preview: true,
    });
  }
}

/** Verify Telegram's secret-token header (set when we registered the webhook). */
export function tgWebhookSecretOk(header: string | undefined): boolean {
  return !WEBHOOK_SECRET || header === WEBHOOK_SECRET;
}

/** On startup: register the webhook, set the blue menu button + the command list. */
export async function setupTelegramBot(): Promise<void> {
  if (!API) {
    console.log("[tgbot] TG_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }
  await tg("setWebhook", {
    url: `${PUBLIC_URL}/tg/webhook`,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  await tg("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Play", web_app: { url: APP_URL } },
  });
  await tg("setMyCommands", {
    commands: [{ command: "start", description: "Play Bomberpump / Играть" }],
  });
  console.log(`[tgbot] webhook -> ${PUBLIC_URL}/tg/webhook, menu button + commands set`);
}
