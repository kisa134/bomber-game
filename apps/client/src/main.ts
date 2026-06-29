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
import {
  Net,
  quickplay,
  createRoom,
  joinRoom,
  practiceRoom,
  fetchProfile,
  setNickname,
  fetchLeaderboard,
  fetchPnl,
  type PnlPoint,
  fetchTables,
  fetchBank,
  fetchPrice,
  withdrawTokens,
  claimDeposit,
  prepareDeposit,
  watchMatch,
  buySkin,
  spinWheel,
  buySkinToken,
  selectSkin,
  attributeReferral,
  fetchReferralStats,
  fetchFriends,
  addFriend,
  acceptFriend,
  removeFriend,
  inviteFriend,
  clearInvite,
  claimDaily,
  fetchTournaments,
  fetchTournament,
  tournamentAction,
  fetchAnnouncement,
  fetchIdentity,
  linkTelegramStart,
  oauthUrl,
  type TournamentInfo,
  type FriendsData,
  type ProfileData,
  type JoinResponse,
} from "./net/socket.js";
import { SERVER_HTTP } from "./config.js";
import { GameState } from "./game/state.js";
import { Renderer, PLAYER_COLORS, skinAvatar } from "./game/renderer.js";
import { Input } from "./game/input.js";
import { Assets, ASSET_VER } from "./game/assets.js";
import { loadSettings, saveSettings, type Settings, type ArenaTheme, type GfxPreset } from "./settings.js";
import {
  listWallets,
  connectAndSignIn,
  loadWallet,
  disconnectWallet,
  shortAddr,
  reauth,
  signAndSendBase64,
} from "./net/wallet.js";
import { setupMenu, setMenuStatus, showScreen, syncChrome, showResult, renderRoom, renderTables, setTokenUsd, setProfileHandler, setKickHandler, setInviteSeatHandler, setSkinSelectHandler, setShopHandler, setLobbySkins, resetCharacterBrowse, setWalletState, setActiveRoom, type ScreenName } from "./ui/lobby.js";
import { renderShareCard, VARIANT_COUNT, type CardData } from "./ui/shareCard.js";
import { initAdminMode } from "./ui/adminOverlay.js";
import { openCardsHub } from "./ui/cardsHub.js";
import { raritySealSVG, editionMarkHTML, tierFromRank } from "./cards/CardLayers.js";
import { initAnalytics, captureAttribution, track, identifyWallet, initErrorTracking } from "./analytics.js";
import { Predictor } from "./game/prediction.js";
import { initTelegram, isTelegram, getStartParam } from "./platform/telegram.js";
import { selectRegion } from "./net/region.js";
import { startPresence } from "./platform/presence.js";
import { enterImmersive } from "./platform/fullscreen.js";
import {
  startTelegramConnect,
  resumeTelegramWallet,
  disconnectTelegramWallet,
  TG_WALLETS,
} from "./net/telegram-wallet.js";
import { registerSW } from "virtual:pwa-register";
import { startCampaign, stopCampaign } from "./campaign/main.js";

const state = new GameState();