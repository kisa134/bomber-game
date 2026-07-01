"use client";

import { useEffect } from "react";
import { getStoredRef } from "@/lib/playUrl";

/** Persist ?ref= from landing URL on first paint. */
export function RefCapture() {
  useEffect(() => {
    getStoredRef();
  }, []);
  return null;
}
