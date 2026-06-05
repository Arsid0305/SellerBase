import { Activity } from 'lucide-react';
import { CategoryCard } from '@/shared/ui/domain/category-card';
import type { ProductEvent } from '@/entities/events';

const SEVERITY_DOT: Record<ProductEvent['severity'], string> = {
  info: 'bg-sky-500',
  warn: 'bg-amber-500',
  critical: 'bg-rose-500',
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y?.slice(2)}`;
}

export function ProductEventsCard({ events }: { events: ProductEvent[] }) {
  return (
    <CategoryCard title="События" tone="violet" icon={Activity}>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">За последние 30 дней событий не зафиксировано.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e, i) => (
            <li key={`${e.date}-${e.kind}-${i}`} className="flex items-start gap-3">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SEVERITY_DOT[e.severity]}`} />
              <div className="flex min-w-0 flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{e.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDate(e.date)}</span>
                </div>
                <span className="text-xs text-muted-foreground">{e.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CategoryCard>
  );
}
