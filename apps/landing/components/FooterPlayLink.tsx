"use client";

import { PlayLink } from "@/components/ui/PlayLink";

export function FooterPlayLink({ children }: { children: React.ReactNode }) {
  return (
    <PlayLink className="footer-link">
      {children}
    </PlayLink>
  );
}
