import { PageLoadingShell, SkeletonBlock } from "@/components/loading/PageLoadingShell";

export default function PartnersLoading() {
  return (
    <PageLoadingShell bg="var(--color-bg-4)">
      <SkeletonBlock className="h-10 w-64" />
      <SkeletonBlock className="h-5 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonBlock key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </PageLoadingShell>
  );
}
