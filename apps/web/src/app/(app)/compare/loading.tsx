import { Skeleton } from '@/shared/ui/skeleton';

export default function CompareLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, col) => (
          <div key={col} className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <Skeleton className="mb-2 h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-7 w-32" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
