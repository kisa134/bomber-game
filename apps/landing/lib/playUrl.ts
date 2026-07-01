"use client";

import { useEffect, useState } from "react";
import { GAME_URL } from "@/lib/gameApi";

const REF_KEY = "bm_ref";

export function getStoredRef(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("ref");
  if (fromUrl) {
    sessionStorage.setItem(REF_KEY, fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem(REF_KEY);
}

export function getPlayUrl(ref?: string | null): string {
  const base = `${GAME_URL}/play`;
  const code = ref ?? (typeof window !== "undefined" ? getStoredRef() : null);
  if (!code) return base;
  return `${base}?ref=${encodeURIComponent(code)}`;
}

/** Persist ?ref= from landing URL and build play links with referral. */
export function usePlayUrl(): string {
  const [url, setUrl] = useState(`${GAME_URL}/play`);

  useEffect(() => {
    setUrl(getPlayUrl());
  }, []);

  return url;
}
