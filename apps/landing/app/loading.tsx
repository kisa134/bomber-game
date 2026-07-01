export default function HomeLoading() {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4" style={{ background: "var(--color-bg-1)" }}>
      <div className="pixel-inset h-3 w-48 animate-pulse" style={{ background: "rgba(245,200,66,0.08)" }} />
      <div className="pixel-inset h-8 w-72 animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
        Loading arena…
      </p>
    </div>
  );
}
