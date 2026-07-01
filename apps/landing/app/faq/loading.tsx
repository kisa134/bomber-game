import { PageLoadingShell, SkeletonBlock } from "@/components/loading/PageLoadingShell";

export default function FaqLoading() {
  return (
    <PageLoadingShell bg="var(--color-bg-1)">
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <div className="hidden flex-col gap-3 lg:flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-4 w-32" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <SkeletonBlock className="h-10 w-full max-w-md" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </PageLoadingShell>
  );
}
