import { Skeleton } from '@/shared/ui/skeleton';

export default function PriceSimulatorLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>

      <Skeleton className="h-10 w-full max-w-md" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="mb-4 h-5 w-40" />
            <Skeleton className="mb-3 h-7 w-32" />
            <Skeleton className="mb-3 h-7 w-32" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
