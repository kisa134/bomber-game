// Honest marker for pages that still show placeholder (mock) data because their
// real source (social APIs etc.) isn't connected yet. No fake numbers passed off
// as real — see /admin/connections.
const DemoBanner = ({ what = "соц-метрики" }: { what?: string }) => (
  <div
    className="mb-4 flex items-center gap-3 rounded-xl border px-4 py-2.5"
    style={{ borderColor: "rgba(245,158,11,.4)", background: "rgba(245,158,11,.1)" }}
  >
    <span className="text-lg">⚠️</span>
    <span className="text-[13px] text-accent-amber">
      <b>DEMO-данные.</b> Этот раздел показывает примерные цифры — {what} ещё не подключены к реальным
      источникам. Статус подключений: <b>Подключения</b>.
    </span>
  </div>
);

export default DemoBanner;
