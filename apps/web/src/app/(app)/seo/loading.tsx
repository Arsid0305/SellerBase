import { Skeleton } from '@/shared/ui/skeleton';

export default function SeoLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-xl border p-5">
            <Skeleton className="mb-3 h-5 w-40" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="border-border bg-card rounded-xl border p-5">
        <Skeleton className="mb-4 h-5 w-56" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-24" />
          ))}
        </div>
      </div>

      <div className="border-border bg-card rounded-xl border p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
