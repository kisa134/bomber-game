"use client";

/**
 * Web3 Auth Context — mock implementation for the "Storefront" phase.
 * Simulates wallet connection states without real blockchain calls.
 * Designed to be swapped for Privy / Dynamic / Phantom wallet integration.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { audioManager } from "./audioManager";

export type AuthStatus = "disconnected" | "connecting" | "connected";

export interface Web3AuthState {
  status:     AuthStatus;
  address:    string | null;
  bmbBalance: number | null;
  mmr:        number | null;
  avatarColor: string;
  connect:    () => void;
  disconnect: () => void;
}

/* ── Mock data simulating a mid-tier ranked player ──────────────────────── */
const MOCK: Pick<Web3AuthState, "address" | "bmbBalance" | "mmr" | "avatarColor"> = {
  address:     "8xFt...3mK9",
  bmbBalance:  142_800,
  mmr:         4_820,
  avatarColor: "#39ff14",
};

const Web3AuthContext = createContext<Web3AuthState>({
  status:      "disconnected",
  address:     null,
  bmbBalance:  null,
  mmr:         null,
  avatarColor: "#39ff14",
  connect:    () => {},
  disconnect: () => {},
});

export function Web3AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("disconnected");

  const connect = useCallback(() => {
    audioManager.unlock();
    audioManager.playClick();
    setStatus("connecting");
    setTimeout(() => {
      setStatus("connected");
      audioManager.playWalletConnect();
    }, 1400);
  }, []);

  const disconnect = useCallback(() => {
    audioManager.playClick();
    setStatus("disconnected");
  }, []);

  const value: Web3AuthState = {
    status,
    address:     status === "connected" ? MOCK.address    : null,
    bmbBalance:  status === "connected" ? MOCK.bmbBalance : null,
    mmr:         status === "connected" ? MOCK.mmr        : null,
    avatarColor: MOCK.avatarColor,
    connect,
    disconnect,
  };

  return (
    <Web3AuthContext.Provider value={value}>
      {children}
    </Web3AuthContext.Provider>
  );
}

export const useWeb3Auth = () => useContext(Web3AuthContext);

/* ── Formatter helpers ───────────────────────────────────────────────────── */
export function fmtBalance(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export function fmtMMR(n: number): string {
  return n.toLocaleString("en-US");
}
