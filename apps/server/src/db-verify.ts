import { store } from "./store.js";
import pg from "pg";
async function main() {
  const W = "VERIFY_" + Date.now();
  await store.recordMatch([{ wallet: W, name: "VerifyBot", skin: 2, won: true, frags: 4, deaths: 1 }]);
  await store.recordMatch([{ wallet: W, name: "VerifyBot", skin: 2, won: false, frags: 1, deaths: 2 }]);
  const p = await store.getProfile(W);
  const lb = await store.leaderboard(3);
  console.log("profile:", p);
  console.log("leaderboard top3 wallets:", lb.map((r) => `${r.name}:${r.xp}xp`));
  // cleanup the verify row
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query("delete from profiles where wallet=$1", [W]);
  await pool.end();
  const ok = !!p && p.matches === 2 && p.wins === 1 && p.frags === 5 && p.xp === (10 + 20 + 30) + (10 + 5);
  console.log(ok ? "DB VERIFY PASSED" : "DB VERIFY FAILED");
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
