import { PageLoadingShell, SkeletonBlock } from "@/components/loading/PageLoadingShell";

export default function DashboardLoading() {
  return (
    <PageLoadingShell bg="var(--color-bg-1)">
      <SkeletonBlock className="h-10 w-56" />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        <SkeletonBlock className="min-h-[420px] w-full rounded-2xl" />
      </div>
    </PageLoadingShell>
  );
}
