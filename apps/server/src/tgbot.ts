// Telegram bot: on /start, send a welcome post + a "Play" button that opens the
// game as a Mini App, plus optional social/site link buttons. Disabled (no-op)
// until TG_BOT_TOKEN is set, so the server runs fine without it.

import { identity, takeLinkCode } from "./identity.js";

const TOKEN = process.env.TG_BOT_TOKEN ?? "";
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : "";
const WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET ?? "bombermeme-webhook";
const PUBLIC_URL = (process.env.PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL ?? "https://bomberpump.onrender.com").replace(/\/+$/, "");
// The marketing landing owns the root; the game (Mini App) lives at /play.
const APP_URL = `${PUBLIC_URL}/play`;

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

/** Proactively DM a linked Telegram user (tournament reminders). No-op if the
 *  bot isn't configured or the chat id is missing. */
export async function notifyTelegram(chatId: number, text: string): Promise<void> {
  if (!API || !chatId) return;
  await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
}

const WELCOME =
  "💣 <b>BomberMeme.fun</b> — fast browser bomberman for the pump.fun crowd.\n\n" +
  "Drop bombs, blow up your rivals, grab power-ups and win the pot. 2–4 players, " +
  "instant matches, right inside Telegram.\n\n" +
  "— — —\n\n" +
  "💣 <b>BomberMeme.fun</b> — быстрый браузерный бомбермен.\n\n" +
  "Ставь бомбы, взрывай соперников, собирай бонусы и забирай банк. 2–4 игрока, " +
  "мгновенные матчи — прямо в Telegram.\n\n" +
  "👇 Play / Играть";

interface Btn {
  text: string;
  url?: string;
  web_app?: { url: string };
  callback_data?: string;
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
  const rows: Btn[][] = [[play], [{ text: "📖 How to play / Как играть", callback_data: "howto" }]];
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

const HOWTO =
  "🎯 <b>Goal:</b> blow up rivals, be the last one standing. 2–4 players, 3-min match.\n" +
  "🎮 <b>Controls:</b> PC — arrows/WASD + Space. Phone — joystick + bomb button.\n" +
  "💣 <b>HP:</b> 3 ❤️, a hit costs 1 (brief invuln). 0 = out. After 2:00 the walls close in.\n" +
  "⚡ <b>Power-ups</b> (from crates): 💣 +bomb · 🔥 +range · 👟 speed · 🦵 kick · 👻 ghost · ❤️ +life\n" +
  "🩸 <b>First Blood:</b> first to wound a rival gets a bonus power-up.\n" +
  "💰 New players get 1000 chips · free match: winner +100, others +20 · staked tables: winner takes the pot (Phantom/Solana).\n\n" +
  "— — —\n\n" +
  "🎯 <b>Цель:</b> взорви соперников, останься последним. 2–4 игрока, матч 3 мин.\n" +
  "🎮 <b>Управление:</b> ПК — стрелки/WASD + Пробел. Телефон — джойстик + кнопка бомбы.\n" +
  "💣 <b>HP:</b> 3 ❤️, попадание −1 (миг неуязвимости). 0 — выбыл. После 2:00 стены сжимаются.\n" +
  "⚡ <b>Бонусы</b> (из ящиков): 💣 +бомба · 🔥 +дальность · 👟 скорость · 🦵 пинать · 👻 сквозь ящики · ❤️ +жизнь\n" +
  "🩸 <b>First Blood:</b> первый, кто заденет соперника, получает бонус-паверап.\n" +
  "💰 Новичку 1000 чипов · бесплатный матч: победитель +100, остальные +20 · ставки: победитель забирает банк (Phantom/Solana).";

/** Send the how-to: a banner image + the full bilingual guide + Play button. */
async function sendHowTo(chatId: number): Promise<void> {
  await tg("sendPhoto", {
    chat_id: chatId,
    photo: `${PUBLIC_URL}/howto/guide.png`,
    caption: "💣 <b>BomberMeme.fun — how to play / как играть</b>",
    parse_mode: "HTML",
  });
  await tg("sendMessage", {
    chat_id: chatId,
    text: HOWTO,
    parse_mode: "HTML",
    reply_markup: keyboard(),
    disable_web_page_preview: true,
  });
}

/** Handle one Telegram update: /start -> welcome post, /help or the How-to
 *  button -> the illustrated guide. */
export async function handleTgUpdate(update: unknown): Promise<void> {
  const u = update as {
    message?: { text?: string; chat?: { id?: number } };
    callback_query?: { id?: string; data?: string; message?: { chat?: { id?: number } } };
  };
  const cb = u?.callback_query;
  if (cb) {
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    const chatId = cb.message?.chat?.id;
    if (chatId && cb.data === "howto") await sendHowTo(chatId);
    return;
  }
  const msg = u?.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text ?? "";
  if (!chatId) return;
  if (/^\/(start|play)\b/.test(text)) {
    // Deep-link account linking: "/start link_<code>" → attach this chat to the
    // wallet that initiated the link in-game, so we can DM reminders.
    const lm = text.match(/^\/start\s+link_([a-z0-9]+)/i);
    if (lm) {
      const wallet = takeLinkCode(lm[1]);
      if (wallet) {
        await identity.link(wallet, { telegramId: chatId });
        await tg("sendMessage", { chat_id: chatId, text: "✅ Telegram linked! You'll get tournament reminders here.", parse_mode: "HTML" });
      } else {
        await tg("sendMessage", { chat_id: chatId, text: "⚠️ That link expired — open the game and tap “Link Telegram” again." });
      }
      return;
    }
    await tg("sendMessage", {
      chat_id: chatId,
      text: WELCOME,
      parse_mode: "HTML",
      reply_markup: keyboard(),
      disable_web_page_preview: true,
    });
  } else if (/^\/help\b/.test(text)) {
    await sendHowTo(chatId);
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
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await tg("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Play", web_app: { url: APP_URL } },
  });
  await tg("setMyCommands", {
    commands: [
      { command: "start", description: "Play BomberMeme.fun / Играть" },
      { command: "help", description: "How to play / Как играть" },
    ],
  });
  console.log(`[tgbot] webhook -> ${PUBLIC_URL}/tg/webhook, menu button + commands set`);
}
