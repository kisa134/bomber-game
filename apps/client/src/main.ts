import {
  ServerMsg,
  MatchPhase,
  Direction,
  PowerUpType,
  DRAW_WINNER_ID,
  PLAYER_BASE_SPEED,
  SPEED_UP_DELTA,
  MATCH_LENGTH_MS,
  SUDDEN_DEATH_AT_MS,
  PROTOCOL_VERSION,
  EMOTES,
  leagueFor,
  LEAGUES,
  STARTING_RATING,
  SPECTATOR_ID,
  TOKEN_MINT,
  TOKEN_TICKER,
  TOKEN_DECIMALS,
  CalloutType,
  SKIN_COUNT,
  SKIN_PRICES,
  DEFAULT_SKINS,
  BET_SIZES,
  TOKEN_BET_SIZES,
  SKIN_UNLOCK_LEVEL,
  SKIN_TOKEN_PRICES,
  WHEEL_PRIZES,
} from "./net/protocol.js";

// Campaign button handler — launches the world mode
import { showScreen } from "./ui/lobby.js";

document.getElementById("open-campaign")?.addEventListener("click", async () => {
  showScreen("campaign");
  const { startCampaign } = await import("./campaign/main.js");
  await startCampaign();
});
