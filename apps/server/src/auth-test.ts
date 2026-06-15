import nacl from "tweetnacl";
import bs58 from "bs58";
const BASE = "http://localhost:8799";
async function main() {
  const kp = nacl.sign.keyPair();
  const pubkey = bs58.encode(kp.publicKey);
  // nonce
  const { nonce } = await (await fetch(`${BASE}/auth/nonce`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pubkey})})).json() as {nonce:string};
  const msg = new TextEncoder().encode(`Bomberpump\nSign in to verify wallet ownership.\n\nNonce: ${nonce}`);
  const sig = nacl.sign.detached(msg, kp.secretKey);
  const signature = Buffer.from(sig).toString("base64");
  // verify good
  const good = await fetch(`${BASE}/auth/verify`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pubkey,nonce,signature})});
  const goodBody = await good.json() as any;
  console.log("good verify:", good.status, goodBody.session ? "session ✓" : goodBody);
  // replay same nonce -> should fail (single use)
  const replay = await fetch(`${BASE}/auth/verify`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pubkey,nonce,signature})});
  console.log("replay (expect 401):", replay.status);
  // tampered signature with fresh nonce -> fail
  const { nonce: n2 } = await (await fetch(`${BASE}/auth/nonce`, {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).json() as {nonce:string};
  const bad = await fetch(`${BASE}/auth/verify`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pubkey,nonce:n2,signature})});
  console.log("wrong sig (expect 401):", bad.status);
  const ok = good.status===200 && !!goodBody.session && replay.status===401 && bad.status===401;
  console.log(ok ? "AUTH TEST PASSED" : "AUTH TEST FAILED");
  process.exit(ok?0:1);
}
main();
