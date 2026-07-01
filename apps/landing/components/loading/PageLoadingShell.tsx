import type { CSSProperties, ReactNode } from "react";

/** Shared subpage loading skeleton shell — bg must match page darkness level. */
export function PageLoadingShell({
  bg,
  children,
}: {
  bg: string;
  children: ReactNode;
}) {
  return (
    <main
      className="relative min-h-[70vh] w-full px-5 py-16 sm:px-8"
      style={{ background: bg }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">{children}</div>
    </main>
  );
}

export function SkeletonBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}
