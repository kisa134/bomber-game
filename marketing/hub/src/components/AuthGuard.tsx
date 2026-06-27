import { useEffect, useState, type FC, type ReactNode } from "react";
import { Bomb } from "lucide-react";
import { getToken, setToken, adminGet } from "@/lib/adminApi";

// Real gate: the admin must enter the ADMIN_TOKEN. We verify it against the
// game server's /admin/stats; only then is the unified control center shown.
const AuthGuard: FC<{ children: ReactNode }> = ({ children }) => {
  const [ok, setOk] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!getToken()) { if (alive) setOk(false); return; }
      try { await adminGet("/admin/stats"); if (alive) setOk(true); }
      catch { if (alive) setOk(false); }
    })();
    return () => { alive = false; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    setToken(input);
    try { await adminGet("/admin/stats"); setOk(true); }
    catch { setErr("Wrong token."); setOk(false); }
    setBusy(false);
  };

  if (ok === null) return <div className="flex h-screen items-center justify-center bg-bg-void text-text-muted">Checking…</div>;
  if (ok) return <>{children}</>;
  return (
    <div className="flex h-screen items-center justify-center bg-bg-void px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-bg-surface p-7 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg,#8B5CF6,#06B6D4)" }}><Bomb className="text-white" /></div>
        <h1 className="font-orbitron text-xl font-bold text-white">Bombermeme Control</h1>
        <p className="mt-1 text-[13px] text-text-muted">Enter the admin token</p>
        <input autoFocus type="password" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Admin token"
          className="mt-4 w-full rounded-lg border border-white/[0.1] bg-bg-void px-3 py-2.5 text-[14px] text-white outline-none focus:border-accent-purple/50" />
        {err && <p className="mt-2 text-[13px] text-accent-red">{err}</p>}
        <button disabled={busy} className="mt-4 w-full rounded-lg py-2.5 text-[14px] font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#8B5CF6,#06B6D4)" }}>{busy ? "Verifying…" : "Enter"}</button>
      </form>
    </div>
  );
};

export default AuthGuard;
