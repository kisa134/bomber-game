import { PageLoadingShell, SkeletonBlock } from "@/components/loading/PageLoadingShell";

export default function TournamentsLoading() {
  return (
    <PageLoadingShell bg="var(--color-bg-2)">
      <SkeletonBlock className="h-10 w-72" />
      <SkeletonBlock className="h-5 w-96 max-w-full" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SkeletonBlock className="h-48 w-full rounded-2xl" />
        <SkeletonBlock className="h-48 w-full rounded-2xl" />
      </div>
      <SkeletonBlock className="h-64 w-full rounded-2xl" />
    </PageLoadingShell>
  );
}
