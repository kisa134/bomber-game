import { PageLoadingShell, SkeletonBlock } from "@/components/loading/PageLoadingShell";

export default function TokenomicsLoading() {
  return (
    <PageLoadingShell bg="var(--color-bg-3)">
      <SkeletonBlock className="h-10 w-80" />
      <div className="grid gap-4 sm:grid-cols-3">
        <SkeletonBlock className="h-28 rounded-xl" />
        <SkeletonBlock className="h-28 rounded-xl" />
        <SkeletonBlock className="h-28 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonBlock className="aspect-square max-h-80 w-full rounded-2xl" />
        <SkeletonBlock className="h-80 w-full rounded-2xl" />
      </div>
    </PageLoadingShell>
  );
}
