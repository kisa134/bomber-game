// Unit tests for the tournament / identity / reward logic. Run with the
// in-memory backends (no DATABASE_URL), so they're hermetic and fast.
//   pnpm --filter @bomberpump/server test
import { test } from "node:test";
import assert from "node:assert/strict";
import { tournaments, sanitizeConfig, seedTournament, reportTournamentMatch } from "./tournament.js";
import { identity, makeLinkCode, takeLinkCode } from "./identity.js";
import { dailyReward } from "./store.js";

test("sanitizeConfig clamps any admin input to safe values", () => {
  const c = sanitizeConfig({
    name: "x".repeat(200),
    format: "weird" as never,
    maxPlayers: 1,
    podSize: 9,
    prizeUsd: -5,
    entryType: "buyin",
    entryAmount: 3.7,
    pointsTable: [],
  });
  assert.ok(c.name.length <= 60);
  assert.equal(c.format, "points"); // unknown → points
  assert.ok(c.maxPlayers >= 4);
  assert.ok(c.podSize >= 2 && c.podSize <= 4);
  assert.equal(c.prizeUsd, 0); // negative clamped
  assert.ok(Number.isInteger(c.entryAmount));
  assert.ok(c.pointsTable.length > 0); // empty → default
});

test("points-race: register → seed → report awards placement points", async () => {
  const t = await tournaments.create(sanitizeConfig({ name: "PointsCup", format: "points", pointsTable: [10, 6, 3, 1], podSize: 4 }), "admin", Date.now());
  for (const w of ["A", "B", "C", "D"]) assert.equal(await tournaments.register(t.id, w, w, Date.now()), "ok");
  assert.equal(await tournaments.register(t.id, "A", "A", Date.now()), "exists"); // no dup

  const seeded = await seedTournament(t.id, () => "ROOM1", Date.now());
  assert.ok(seeded);
  assert.equal(seeded.pods.length, 1);
  assert.equal(seeded.pods[0].roomCode, "ROOM1");

  await reportTournamentMatch(t.id, "ROOM1", ["A", "B", "C", "D"], Date.now());
  const pts = Object.fromEntries((await tournaments.players(t.id)).map((p) => [p.wallet, p.points]));
  assert.equal(pts.A, 10);
  assert.equal(pts.B, 6);
  assert.equal(pts.C, 3);
  assert.equal(pts.D, 1);

  // A second pod result accumulates points (race over multiple games).
  const s2 = await seedTournament(t.id, () => "ROOM2", Date.now());
  await reportTournamentMatch(t.id, s2!.pods[0].roomCode, ["B", "A", "C", "D"], Date.now());
  const pts2 = Object.fromEntries((await tournaments.players(t.id)).map((p) => [p.wallet, p.points]));
  assert.equal(pts2.A, 16); // 10 + 6
  assert.equal(pts2.B, 16); // 6 + 10
});

test("bracket: top finishers advance, the rest are eliminated", async () => {
  const t = await tournaments.create(sanitizeConfig({ name: "Bracket", format: "bracket", podSize: 4, podsAdvance: 1 }), "admin", Date.now());
  for (const w of ["A", "B", "C", "D"]) await tournaments.register(t.id, w, w, Date.now());
  const seeded = await seedTournament(t.id, () => "BR1", Date.now());
  await reportTournamentMatch(t.id, seeded!.pods[0].roomCode, ["A", "B", "C", "D"], Date.now());
  const st = Object.fromEntries((await tournaments.players(t.id)).map((p) => [p.wallet, p.status]));
  assert.equal(st.A, "active"); // winner advances
  assert.equal(st.B, "eliminated");
  assert.equal(st.D, "eliminated");
});

test("a finished/duplicate match report is ignored (no double scoring)", async () => {
  const t = await tournaments.create(sanitizeConfig({ name: "Dedup", format: "points", pointsTable: [5, 3, 2, 1] }), "admin", Date.now());
  for (const w of ["A", "B"]) await tournaments.register(t.id, w, w, Date.now());
  const s = await seedTournament(t.id, () => "DUP1", Date.now());
  const room = s!.pods[0].roomCode;
  await reportTournamentMatch(t.id, room, ["A", "B"], Date.now());
  await reportTournamentMatch(t.id, room, ["A", "B"], Date.now()); // second call ignored
  const pts = Object.fromEntries((await tournaments.players(t.id)).map((p) => [p.wallet, p.points]));
  assert.equal(pts.A, 5); // not 10
});

test("link codes are single-use and validate", () => {
  const code = makeLinkCode("WALLET_X");
  assert.equal(takeLinkCode(code), "WALLET_X");
  assert.equal(takeLinkCode(code), null); // consumed
  assert.equal(takeLinkCode("does-not-exist"), null);
});

test("identity link + lookup", async () => {
  await identity.link("WI", { telegramId: 4242, email: "a@b.com" });
  const i = await identity.get("WI");
  assert.equal(i?.telegramId, 4242);
  assert.equal(i?.email, "a@b.com");
  assert.equal(await identity.byTelegram(4242), "WI");
  // partial update keeps prior fields
  await identity.link("WI", { twitter: "handle" });
  const j = await identity.get("WI");
  assert.equal(j?.telegramId, 4242);
  assert.equal(j?.twitter, "handle");
});

test("daily reward scales with streak and pays a 7-day bonus", () => {
  const d1 = dailyReward(1, 1);
  const d7 = dailyReward(7, 1);
  assert.ok(d1.chips > 0 && d1.xp > 0);
  assert.equal(d7.bonus, true);
  assert.ok(d7.chips > d1.chips);
  assert.equal(dailyReward(3, 1).bonus, false);
});
