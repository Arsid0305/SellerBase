import { Radio } from 'lucide-react';
import { CategoryCard } from '@/shared/ui/domain/category-card';
import type { SkuEvent } from '@/entities/sku-events';

const TYPE_ICON: Record<string, string> = {
  lifecycle_changed: '📦',
  price_changed: '💰',
  rating_changed: '⭐',
  stock_zero: '📦',
  promo_joined: '📈',
  sales_resumed: '📈',
  sales_stopped: '📉',
  cost_updated: '💰',
  anomaly_detected: '⚠️',
};

const SEVERITY_DOT: Record<SkuEvent['severity'], string> = {
  info: 'bg-sky-500',
  warn: 'bg-amber-500',
  critical: 'bg-rose-500',
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  const diffDays = Math.floor(diffH / 24);
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return `${diffDays} дн назад`;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${String(d.getFullYear()).slice(2)}`;
}

function formatDetails(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  const entries = Object.entries(details);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(' · ');
}

export function EventsCard({ events }: { events: SkuEvent[] }) {
  return (
    <CategoryCard title="Лента событий" tone="violet" icon={Radio}>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Событий пока нет.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) => {
            const detail = formatDetails(e.details);
            return (
              <li key={e.id} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-base leading-none">
                  {TYPE_ICON[e.eventType] ?? '•'}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className={`size-1.5 shrink-0 rounded-full ${SEVERITY_DOT[e.severity]}`} />
                    <span className="text-sm font-medium">{e.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatRelative(e.eventDt)}
                    </span>
                  </div>
                  {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CategoryCard>
  );
}
