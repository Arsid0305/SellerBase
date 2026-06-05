import { History } from 'lucide-react';
import { CategoryCard } from '@/shared/ui/domain/category-card';
import type { SnapshotDiff, SnapshotField } from '@/entities/snapshots';

const FIELD_LABEL: Record<SnapshotField, string> = {
  title: 'Название',
  brand: 'Бренд',
  price_rub: 'Цена',
  rating: 'Рейтинг',
  reviews_count: 'Отзывы',
  is_active: 'Активен',
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y?.slice(2)}`;
}

function formatValue(field: SnapshotField, v: SnapshotDiff['before']): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'да' : 'нет';
  if (field === 'price_rub') return `${Math.round(Number(v))} ₽`;
  if (field === 'rating') return Number(v).toFixed(2);
  return String(v);
}

export function ProductHistoryCard({ diffs }: { diffs: SnapshotDiff[] }) {
  return (
    <CategoryCard title="История карточки" tone="neutral" icon={History}>
      {diffs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Изменений в карточке не зафиксировано.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {diffs.map((d, i) => (
            <li key={`${d.date}-${d.field}-${i}`} className="flex items-start gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/50" />
              <div className="flex min-w-0 flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDate(d.date)}</span>
                  <span className="text-sm font-medium">{FIELD_LABEL[d.field]}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatValue(d.field, d.before)} → {formatValue(d.field, d.after)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CategoryCard>
  );
}
