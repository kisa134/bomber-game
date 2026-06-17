// Solana wallet connect via the Wallet Standard — works with every wallet that
// implements it (Phantom, Solflare, Backpack, Glow, …) with no per-wallet code.
// Auth: sign a server nonce -> server verifies ed25519 -> returns an HMAC session
// bound to the wallet address (Sign-In With Solana, lite).

import { getWallets } from "@wallet-standard/app";
import { SERVER_HTTP } from "../config.js";

// Wallet Standard feature keys (namespaced strings).
const F_CONNECT = "standard:connect";
const F_SIGN_MESSAGE = "solana:signMessage";
const F_SIGN_SEND = "solana:signAndSendTransaction";

// Minimal structural typing over the Wallet Standard objects we touch.
interface StdAccount {
  address: string;
}
export interface StdWallet {
  name: string;
  icon: string;
  accounts: readonly StdAccount[];
  features: Record<string, unknown>;
}

export interface ConnectedWallet {
  address: string;
  session: string;
  walletName: string;
}

/** Detected wallets that can connect and sign a message. */
export function listWallets(): StdWallet[] {
  const { get } = getWallets();
  return get().filter(
    (w) => F_SIGN_MESSAGE in w.features && F_CONNECT in w.features,
  ) as unknown as StdWallet[];
}

export function shortAddr(a: string): string {
  return a.length > 9 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export async function connectAndSignIn(wallet: StdWallet): Promise<ConnectedWallet> {
  // Connect (or reuse an authorized account).
  let account = wallet.accounts[0];
  if (!account) {
    const connect = wallet.features[F_CONNECT] as { connect(): Promise<{ accounts: StdAccount[] }> };
    const res = await connect.connect();
    account = res.accounts[0];
  }
  if (!account) throw new Error("No account authorized");
  const address = account.address;

  // Server nonce.
  const nonceRes = await fetch(`${SERVER_HTTP}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey: address }),
  });
  const { nonce } = (await nonceRes.json()) as { nonce: string };

  // Sign the exact message the server will reconstruct.
  const message = new TextEncoder().encode(
    `Bombermeme\nSign in to verify wallet ownership.\n\nNonce: ${nonce}`,
  );
  const signMessage = wallet.features[F_SIGN_MESSAGE] as {
    signMessage(input: { account: StdAccount; message: Uint8Array }): Promise<
      Array<{ signature: Uint8Array }>
    >;
  };
  const [out] = await signMessage.signMessage({ account, message });
  let bin = "";
  for (const b of out.signature) bin += String.fromCharCode(b);
  const signature = btoa(bin);

  // Verify on the server -> session.
  const verifyRes = await fetch(`${SERVER_HTTP}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey: address, nonce, signature }),
  });
  if (!verifyRes.ok) throw new Error("Signature rejected");
  const { session } = (await verifyRes.json()) as { session: string };

  const data: ConnectedWallet = { address, session, walletName: wallet.name };
  localStorage.setItem("bp_wallet", JSON.stringify(data));
  return data;
}

/** Re-sign-in with the previously connected wallet (e.g. after the server
 *  restarted and invalidated the old session). Returns true on success. */
export async function reauth(): Promise<boolean> {
  const stored = loadWallet();
  if (!stored) return false;
  const wallets = listWallets();
  const w = wallets.find((x) => x.name === stored.walletName) ?? wallets[0];
  if (!w) return false;
  try {
    await connectAndSignIn(w);
    return true;
  } catch {
    return false;
  }
}

/** Sign & send a server-built (base64) transaction with the connected wallet.
 *  Pops the wallet's approval UI; we never see the private key. */
export async function signAndSendBase64(base64Tx: string): Promise<void> {
  const stored = loadWallet();
  if (!stored) throw new Error("Connect a wallet first");
  const { get } = getWallets();
  const wallet = get().find((w) => w.name === stored.walletName) as unknown as StdWallet | undefined;
  if (!wallet || !(F_SIGN_SEND in wallet.features)) {
    throw new Error("This wallet can't send transactions in-app — use the deposit address instead");
  }
  const account =
    wallet.accounts.find((a) => a.address === stored.address) ?? wallet.accounts[0];
  if (!account) throw new Error("Reconnect your wallet");
  const bytes = Uint8Array.from(atob(base64Tx), (c) => c.charCodeAt(0));
  const feature = wallet.features[F_SIGN_SEND] as {
    signAndSendTransaction(input: {
      account: StdAccount;
      transaction: Uint8Array;
      chain: string;
    }): Promise<Array<{ signature: Uint8Array }>>;
  };
  await feature.signAndSendTransaction({ account, transaction: bytes, chain: "solana:mainnet" });
}

export function loadWallet(): ConnectedWallet | null {
  try {
    const raw = localStorage.getItem("bp_wallet");
    return raw ? (JSON.parse(raw) as ConnectedWallet) : null;
  } catch {
    return null;
  }
}

export function disconnectWallet(): void {
  localStorage.removeItem("bp_wallet");
}
