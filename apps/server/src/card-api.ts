// ============================================================================
// card-api.ts — BomberMeme CCG REST API Endpoints
// ============================================================================
// Server-authoritative card game API. All card generation, validation,
// and economy operations happen on the server. The client only requests
// and displays — never decides what cards appear.
//
// Endpoints:
//   GET  /api/cards/inventory        — player's cards
//   GET  /api/cards/templates        — all card templates
//   GET  /api/cards/templates/:set   — templates by set
//   POST /api/packs/open             — open a pack (server rolls cards)
//   POST /api/cards/fuse             — fuse 3 cards into 1
//   GET  /api/market/listings        — browse listings
//   GET  /api/market/floor           — floor price data
//   GET  /api/market/history         — sales history
//   GET  /api/market/my-listings     — player's listings
//   POST /api/market/list            — create listing
//   POST /api/market/buy             — buy a listing
//   POST /api/market/cancel          — cancel a listing
// ============================================================================

import * as uWS from "uwebsockets";
import type {
  OpenPackRequest,
  OpenPackResponse,
  FuseCardsRequest,
  FuseCardsResponse,
  GetInventoryResponse,
  GetListingsResponse,
  GetFloorResponse,
  GetHistoryResponse,
  CreateListingRequest,
  CreateListingResponse,
  BuyListingRequest,
  BuyListingResponse,
  CancelListingRequest,
  CancelListingResponse,
  GetMyListingsResponse,
  GetTemplatesResponse,
  RevealedCard,
  PackType,
  FUSION_RECIPES,
  PACK_CONFIGS,
} from "@bomberpump/shared";
import { cardStore } from "./card-store.js";
import { verifySession } from "./auth.js";

// ── Dependencies interface (avoid circular imports) ─────────────────────────

export interface CardAPIDeps {
  app: uWS.TemplatedApp;
  guard: (res: uWS.HttpResponse, req: uWS.HttpRequest) => boolean;
  readBody: (res: uWS.HttpResponse) => Promise<string>;
  sendJson: (res: uWS.HttpResponse, obj: unknown, status?: string) => void;
  store: {
    pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number | null }> };
    adjustChips: (wallet: string, amount: number, ctx: string) => Promise<number | null>;
    getProfile: (wallet: string) => Promise<{ wallet: string; token_balance: number; chips: number } | null>;
  };
  fromBaseUnits: (n: number) => number;
  toBaseUnits: (n: number) => number;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerCardAPI(deps: CardAPIDeps): void {
  const { app, guard, readBody, sendJson, store, toBaseUnits } = deps;

  // ── Seed templates on startup (idempotent) ──────────────────────────────
  void cardStore.seedTemplates();

  // ══════════════════════════════════════════════════════════════════════════
  // INVENTORY
  // ══════════════════════════════════════════════════════════════════════════

  /** GET /api/cards/inventory — get player's cards */
  app.get("/api/cards/inventory", (res, req) => {
    if (!guard(res, req)) return;
    const url = new URL(req.getUrl() + "?" + req.getQuery(), "http://_");
    const session = url.searchParams.get("session") || "";
    const wallet = session ? verifySession(session) : null;
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");

    void (async () => {
      try {
        const [cards, progress] = await Promise.all([
          cardStore.getPlayerCards(wallet),
          cardStore.getCollectionProgress(wallet),
        ]);
        const allTemplates = await cardStore.getAllTemplates();
        const response: GetInventoryResponse = {
          cards,
          progress,
          totalCards: allTemplates.length,
        };
        sendJson(res, response);
      } catch (e) {
        console.error("[cards/inventory]", e);
        sendJson(res, { error: "server_error" }, "500 Internal Server Error");
      }
    })();
  });

  /** GET /api/cards/templates — all card templates */
  app.get("/api/cards/templates", (res, req) => {
    if (!guard(res, req)) return;
    void (async () => {
      try {
        const templates = await cardStore.getAllTemplates();
        sendJson(res, { templates } satisfies GetTemplatesResponse);
      } catch (e) {
        console.error("[cards/templates]", e);
        sendJson(res, { error: "server_error" }, "500 Internal Server Error");
      }
    })();
  });

  /** GET /api/cards/templates/:setId — templates by set */
  app.get("/api/cards/templates/*", (res, req) => {
    if (!guard(res, req)) return;
    const setId = req.getParameter(0);
    void (async () => {
      try {
        const templates = await cardStore.getTemplatesBySet(setId as never);
        sendJson(res, { templates } satisfies GetTemplatesResponse);
      } catch (e) {
        console.error("[cards/templates/:set]", e);
        sendJson(res, { error: "server_error" }, "500 Internal Server Error");
      }
    })();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PACK OPENING
  // ══════════════════════════════════════════════════════════════════════════

  /** POST /api/packs/open — server-authoritative pack opening */
  app.post("/api/packs/open", (res, req) => {
    if (!guard(res, req)) return;
    void readBody(res).then(async (body) => {
      let wallet: string | null = null;
      let packType: PackType = "basic";
      try {
        const j = JSON.parse(body || "{}") as OpenPackRequest;
        if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
        if (["basic", "premium", "legendary"].includes(j.packType)) packType = j.packType;
      } catch { /* ignore */ }

      if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");

      try {
        const config = PACK_CONFIGS[packType];
        if (!config) return sendJson(res, { error: "invalid_pack_type" }, "400 Bad Request");

        // Check balance
        const profile = await store.getProfile(wallet);
        if (!profile) return sendJson(res, { error: "profile_not_found" }, "404 Not Found");

        let newBalance: number | null = null;
        if (config.costCurrency === "chips") {
          if (profile.chips < config.cost) {
            return sendJson(res, { error: "insufficient_chips" }, "400 Bad Request");
          }
          newBalance = await store.adjustChips(wallet, -config.cost, `pack_open_${packType}`);
        } else {
          const costBase = toBaseUnits(config.cost);
          if (profile.token_balance < costBase) {
            return sendJson(res, { error: "insufficient_tokens" }, "400 Bad Request");
          }
          // Token adjustment via raw pool query (adjustChips is chips only)
          await store.pool.query(
            `UPDATE profiles SET token_balance = token_balance - $2 WHERE wallet = $1`,
            [wallet, costBase]
          );
          newBalance = config.cost; // approximate display value
        }

        // Server generates the cards (anti-cheat: client never decides)
        const templates = await cardStore.getRandomCardsForPack(packType);
        const revealed: RevealedCard[] = [];

        for (const template of templates) {
          const instance = await cardStore.createCardInstance(wallet, template.cardTemplateId, {
            source: "pack_open",
          });
          revealed.push({
            cardTemplateId: template.cardTemplateId,
            instanceId: instance.instanceId,
            characterName: template.characterName,
            tier: template.tier,
            momentId: template.momentId,
            momentName: template.momentName,
            isNew: true,
            isFoil: instance.isFoil,
          });
        }

        // Audit log
        await cardStore.recordPackOpen(wallet, packType, config.costCurrency, config.cost, revealed);

        const response: OpenPackResponse = {
          success: true,
          revealed,
          packType,
          cost: config.cost,
          newBalance: newBalance ?? 0,
        };
        sendJson(res, response);
      } catch (e) {
        console.error("[packs/open]", e);
        sendJson(res, { error: "server_error" }, "500 Internal Server Error");
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FUSION
  // ══════════════════════════════════════════════════════════════════════════

  /** POST /api/cards/fuse — fuse 3 cards into 1 upgrade */
  app.post("/api/cards/fuse", (res, req) => {
    if (!guard(res, req)) return;
    void readBody(res).then(async (body) => {
      let wallet: string | null = null;
      let instanceIds: [string, string, string] = ["", "", ""];
      try {
        const j = JSON.parse(body || "{}") as FuseCardsRequest;
        if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
        if (Array.isArray(j.instanceIds) && j.instanceIds.length === 3) {
          instanceIds = j.instanceIds as [string, string, string];
        }
      } catch { /* ignore */ }

      if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
      if (!instanceIds[0] || !instanceIds[1] || !instanceIds[2]) {
        return sendJson(res, { error: "three_cards_required" }, "400 Bad Request");
      }

      try {
        // Validate ownership
        const ownsAll = await cardStore.validateOwnership(wallet, instanceIds);
        if (!ownsAll) return sendJson(res, { error: "ownership_failed" }, "403 Forbidden");

        // Get cards
        const cards = await Promise.all(instanceIds.map((id) => cardStore.getCardInstance(id)));
        if (cards.some((c) => !c || c.source === "consumed")) {
          return sendJson(res, { error: "card_not_found" }, "404 Not Found");
        }

        // Find matching recipe
        const [a, b, c] = cards;
        let matchedRecipe = FUSION_RECIPES.find((r) => {
          if (a!.tier !== r.inputTier) return false;
          if (r.requireFoil && !a!.isFoil) return false;
          if (r.requireSameCharacter && !(a!.characterId === b!.characterId && b!.characterId === c!.characterId)) return false;
          if (r.requireSameMoment && !(a!.momentId === b!.momentId && b!.momentId === c!.momentId)) return false;
          return true;
        });

        if (!matchedRecipe) {
          return sendJson(res, { error: "no_matching_recipe", consumed: instanceIds, fee: 0 }, "400 Bad Request");
        }

        // Check balance for fee
        if (matchedRecipe.feeCurrency === "chips") {
          const balance = await store.adjustChips(wallet, -matchedRecipe.fee, `fusion_${matchedRecipe.inputTier}_to_${matchedRecipe.outputTier}`);
          if (balance === null) {
            return sendJson(res, { error: "insufficient_chips", consumed: [], fee: matchedRecipe.fee }, "400 Bad Request");
          }
        }

        // Find output template
        const templates = await cardStore.getAllTemplates();
        const outputTemplate = templates.find(
          (t) => t.tier === matchedRecipe!.outputTier && t.characterId === a!.characterId
        );
        if (!outputTemplate) {
          return sendJson(res, { error: "no_output_template", consumed: [], fee: 0 }, "500 Internal Server Error");
        }

        // Consume inputs
        await cardStore.consumeCards(instanceIds);

        // Create output
        const result = await cardStore.createCardInstance(wallet, outputTemplate.cardTemplateId, {
          isFoil: matchedRecipe.outputIsFoil,
          isGoldFrame: matchedRecipe.outputIsGoldFrame,
          source: "fusion",
        });

        // Record
        await cardStore.recordFusion(wallet, instanceIds, result.instanceId, matchedRecipe);

        const response: FuseCardsResponse = {
          success: true,
          result,
          consumed: instanceIds,
          fee: matchedRecipe.fee,
        };
        sendJson(res, response);
      } catch (e) {
        console.error("[cards/fuse]", e);
        sendJson(res, { error: "server_error", consumed: [], fee: 0 }, "500 Internal Server Error");
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // MARKET — BROWSE (no auth required)
  // ══════════════════════════════════════════════════════════════════════════

  /** GET /api/market/listings — browse active listings */
  app.get("/api/market/listings", (res, req) => {
    if (!guard(res, req)) return;
    const url = new URL(req.getUrl() + "?" + req.getQuery(), "http://_");
    const tier = url.searchParams.get("tier") || undefined;
    const setId = url.searchParams.get("setId") || undefined;
    const sortBy = url.searchParams.get("sortBy") || "recent";
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    void (async () => {
      try {
        const { listings, total } = await cardStore.getListings({ tier, setId, sortBy, limit, offset });
        sendJson(res, { listings, total } satisfies GetListingsResponse);
      } catch (e) {
        console.error("[market/listings]", e);
        sendJson(res, { error: "server_error" }, "500 Internal Server Error");
      }
    })();
  });

  /** GET /api/market/floor — floor price data */
  app.get("/api/market/floor", (res, req) => {
    if (!guard(res, req)) return;
    const url = new URL(req.getUrl() + "?" + req.getQuery(), "http://_");
    const cardTemplateId = url.searchParams.get("cardTemplateId");

    void (async () => {
      try {
        const floors = await cardStore.getFloorData(
          cardTemplateId ? parseInt(cardTemplateId, 10) : undefined
        );
        sendJson(res, { floors } satisfies GetFloorResponse);
      } catch (e) {
        console.error("[market/floor]", e);
        sendJson(res, { error: "server_error" }, "500 Internal Server Error");
      }
    })();
  });

  /** GET /api/market/history — sales history */
  app.get("/api/market/history", (res, req) => {
    if (!guard(res, req)) return;
    const url = new URL(req.getUrl() + "?" + req.getQuery(), "http://_");
    const cardTemplateId = url.searchParams.get("cardTemplateId");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    void (async () => {
      try {
        const sales = await cardStore.getSalesHistory({
          cardTemplateId: cardTemplateId ? parseInt(cardTemplateId, 10) : undefined,
          limit,
        });
        sendJson(res, { sales } satisfies GetHistoryResponse);
      } catch (e) {
        console.error("[market/history]", e);
        sendJson(res, { error: "server_error" }, "500 Internal Server Error");
      }
    })();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // MARKET — AUTHENTICATED ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  /** GET /api/market/my-listings — player's listings */
  app.get("/api/market/my-listings", (res, req) => {
    if (!guard(res, req)) return;
    const url = new URL(req.getUrl() + "?" + req.getQuery(), "http://_");
    const session = url.searchParams.get("session") || "";
    const wallet = session ? verifySession(session) : null;
    if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");

    void (async () => {
      try {
        const listings = await cardStore.getMyListings(wallet);
        sendJson(res, { listings } satisfies GetMyListingsResponse);
      } catch (e) {
        console.error("[market/my-listings]", e);
        sendJson(res, { error: "server_error" }, "500 Internal Server Error");
      }
    })();
  });

  /** POST /api/market/list — create a listing */
  app.post("/api/market/list", (res, req) => {
    if (!guard(res, req)) return;
    void readBody(res).then(async (body) => {
      let wallet: string | null = null;
      let instanceId = "";
      let price = 0;
      try {
        const j = JSON.parse(body || "{}") as CreateListingRequest;
        if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
        if (typeof j.instanceId === "string") instanceId = j.instanceId;
        if (typeof j.price === "number") price = Math.max(1, Math.floor(j.price));
      } catch { /* ignore */ }

      if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
      if (!instanceId || price <= 0) {
        return sendJson(res, { error: "invalid_params" }, "400 Bad Request");
      }

      try {
        // Validate ownership
        const owns = await cardStore.validateOwnership(wallet, [instanceId]);
        if (!owns) return sendJson(res, { error: "ownership_failed" }, "403 Forbidden");

        // Check not already listed
        const existing = await store.pool.query(
          `SELECT 1 FROM market_listings WHERE instance_id = $1 AND status = 'active'`,
          [instanceId]
        );
        if ((existing.rowCount ?? 0) > 0) {
          return sendJson(res, { error: "already_listed" }, "400 Bad Request");
        }

        const listing = await cardStore.createListing(wallet, instanceId, price);
        const response: CreateListingResponse = { success: true, listing };
        sendJson(res, response);
      } catch (e) {
        console.error("[market/list]", e);
        sendJson(res, { error: "server_error" }, "500 Internal Server Error");
      }
    });
  });

  /** POST /api/market/buy — purchase a listing */
  app.post("/api/market/buy", (res, req) => {
    if (!guard(res, req)) return;
    void readBody(res).then(async (body) => {
      let wallet: string | null = null;
      let listingId = "";
      try {
        const j = JSON.parse(body || "{}") as BuyListingRequest;
        if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
        if (typeof j.listingId === "string") listingId = j.listingId;
      } catch { /* ignore */ }

      if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
      if (!listingId) return sendJson(res, { error: "listing_id_required" }, "400 Bad Request");

      try {
        // Get listing
        const listing = await cardStore.getListing(listingId);
        if (!listing) return sendJson(res, { error: "listing_not_found" }, "404 Not Found");
        if (listing.status !== "active") return sendJson(res, { error: "listing_not_active" }, "400 Bad Request");
        if (listing.wallet === wallet) return sendJson(res, { error: "cannot_buy_own" }, "400 Bad Request");

        // Deduct buyer's balance (chips for now — marketplace uses chips)
        const newBalance = await store.adjustChips(wallet, -listing.price, `market_buy_${listingId}`);
        if (newBalance === null) {
          return sendJson(res, { error: "insufficient_chips", newBalance: 0 }, "400 Bad Request");
        }

        // Credit seller
        await store.adjustChips(listing.wallet, listing.price, `market_sell_${listingId}`);

        // Transfer ownership
        const transferred = await cardStore.transferCardOwnership(
          listing.instanceId, listing.wallet, wallet
        );
        if (!transferred) {
          // Rollback: refund buyer
          await store.adjustChips(wallet, listing.price, `market_refund_${listingId}`);
          return sendJson(res, { error: "transfer_failed", newBalance }, "500 Internal Server Error");
        }

        // Mark listing as sold
        await cardStore.markListingSold(listingId, wallet);

        // Record in history
        await cardStore.recordSale(listingId, listing.wallet, wallet, listing.instanceId, listing.price);

        const response: BuyListingResponse = {
          success: true,
          sale: {
            saleId: `sl_${Date.now()}`,
            listingId,
            sellerWallet: listing.wallet,
            buyerWallet: wallet,
            instanceId: listing.instanceId,
            price: listing.price,
            soldAt: new Date().toISOString(),
          },
          newBalance,
        };
        sendJson(res, response);
      } catch (e) {
        console.error("[market/buy]", e);
        sendJson(res, { error: "server_error", newBalance: 0 }, "500 Internal Server Error");
      }
    });
  });

  /** POST /api/market/cancel — cancel own listing */
  app.post("/api/market/cancel", (res, req) => {
    if (!guard(res, req)) return;
    void readBody(res).then(async (body) => {
      let wallet: string | null = null;
      let listingId = "";
      try {
        const j = JSON.parse(body || "{}") as CancelListingRequest;
        if (typeof j.session === "string" && j.session) wallet = verifySession(j.session);
        if (typeof j.listingId === "string") listingId = j.listingId;
      } catch { /* ignore */ }

      if (!wallet) return sendJson(res, { error: "wallet_required" }, "401 Unauthorized");
      if (!listingId) return sendJson(res, { error: "listing_id_required" }, "400 Bad Request");

      try {
        const cancelled = await cardStore.cancelListing(listingId, wallet);
        const response: CancelListingResponse = { success: cancelled };
        if (!cancelled) {
          sendJson(res, { ...response, error: "listing_not_found_or_not_owned" }, "404 Not Found");
        } else {
          sendJson(res, response);
        }
      } catch (e) {
        console.error("[market/cancel]", e);
        sendJson(res, { error: "server_error" }, "500 Internal Server Error");
      }
    });
  });
}
