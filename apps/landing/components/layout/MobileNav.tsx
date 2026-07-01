"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayUrl } from "@/lib/playUrl";

const TABS = [
  { label: "Arena", href: "/" },
  { label: "Ranked", href: "/tournaments" },
  { label: "Guild", href: "/partners" },
  { label: "Play", href: "__play__", external: true },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const playUrl = usePlayUrl();

  return (
    <nav
      className="mobile-nav fixed bottom-0 left-0 right-0 z-50 flex md:hidden"
      aria-label="Mobile navigation"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(7,8,16,0.96)",
        borderTop: "2px solid rgba(245,200,66,0.18)",
        boxShadow: "0 -4px 0 rgba(0,0,0,0.45)",
      }}
    >
      {TABS.map((tab) => {
        const isPlay = tab.href === "__play__";
        const href = isPlay ? playUrl : tab.href;
        const active = !isPlay && (tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href));
        const cls = `mobile-nav-tab flex-1 ${active ? "is-active" : ""}`;

        if (isPlay) {
          return (
            <a key={tab.label} href={href} target="_blank" rel="noopener noreferrer" className={`${cls} mobile-nav-tab--play`}>
              ▶ {tab.label}
            </a>
          );
        }
        return (
          <Link key={tab.label} href={href} className={cls}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
