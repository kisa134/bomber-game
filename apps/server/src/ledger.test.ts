// Unit tests for the immutable financial audit ledger. Runs against the in-memory
// backend (no DATABASE_URL) so it's hermetic. Verifies every balance move leaves a
// traceable ledger row and overdraws never appear.
//   pnpm --filter @bomberpump/server test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "./store.js";

test("adjustToken records an audit row with context", async () => {
  const s = createStore();
  const w = "WalletA";
  await s.adjustToken(w, 100_000, { type: "deposit", actor: "player", ref: "sig123", note: "test deposit" });
  const rows = await s.recentLedger(10);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.wallet, w);
  assert.equal(r.currency, "token");
  assert.equal(r.delta, 100_000);
  assert.equal(r.balanceAfter, 100_000);
  assert.equal(r.type, "deposit");
  assert.equal(r.actor, "player");
  assert.equal(r.ref, "sig123");
});

test("overdraw is rejected and writes NO ledger row", async () => {
  const s = createStore();
  const w = "WalletB";
  await s.adjustToken(w, 50, { type: "deposit" });
  const before = (await s.recentLedger(100)).length;
  const res = await s.adjustToken(w, -100, { type: "withdraw" }); // would overdraw
  assert.equal(res, null);
  const after = await s.recentLedger(100);
  assert.equal(after.length, before, "overdraw must not append a ledger row");
});

test("ledger is newest-first and tracks running balance", async () => {
  const s = createStore();
  const w = "WalletC";
  await s.adjustChips(w, 10, { type: "grant" });
  await s.adjustChips(w, 5, { type: "reward" });
  await s.adjustChips(w, -3, { type: "skin" });
  const rows = await s.recentLedger(10);
  assert.equal(rows.length, 3);
  // newest first
  assert.equal(rows[0].type, "skin");
  assert.equal(rows[0].delta, -3);
  assert.equal(rows[2].type, "grant");
  assert.equal(rows[2].delta, 10);
  // running balance is consistent: each row's balanceAfter == prev + delta
  assert.equal(rows[0].balanceAfter! - rows[1].balanceAfter!, -3);
  assert.equal(rows[1].balanceAfter! - rows[2].balanceAfter!, 5);
});

test("deposit + withdraw round-trip is fully traced", async () => {
  const s = createStore();
  const w = "WalletD";
  await s.creditDeposit("sigDeposit", w, 1_000);
  const after = await s.adjustToken(w, -400, { type: "withdraw", actor: "player" });
  assert.equal(after, 600);
  const rows = await s.recentLedger(10);
  const types = rows.map((r) => r.type);
  assert.ok(types.includes("deposit"));
  assert.ok(types.includes("withdraw"));
  // net of all token deltas equals the final balance
  const net = rows.filter((r) => r.currency === "token").reduce((a, r) => a + r.delta, 0);
  assert.equal(net, 600);
});
