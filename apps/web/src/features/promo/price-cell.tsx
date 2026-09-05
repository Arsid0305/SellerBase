'use client';

import { formatRub } from '@/shared/lib/format';

// Показ цены и её истории. Редактирования здесь нет и не будет без отдельного
// распоряжения владелицы: 05.09.2026 принято решение «абсолютно все записи
// на ВБ отменяются, только ручные». Цены меняются в кабинете WB.
//
// До этого компонент назывался PriceEditCell и умел отправлять новую цену
// через /api/promo/set-price → Edge Function set-wb-price. Всё это удалено,
// прежний код — в истории git по файлу price-edit-cell.tsx.

type Props = {
  currentPrice: number | null;
  history: { date: string; price: number }[];
};

export function PriceCell({ currentPrice, history }: Props) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="tabular-nums" title="Цена меняется вручную в кабинете WB">
        {currentPrice == null ? '—' : formatRub(currentPrice)}
      </span>
      <PriceSparkline history={history} />
    </div>
  );
}

function PriceSparkline({ history }: { history: { date: string; price: number }[] }) {
  if (history.length < 2) return <div className="h-4" />;
  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 50;
  const h = 12;
  const step = w / (history.length - 1);
  const points = history
    .map((p, i) => `${(i * step).toFixed(1)},${(h - ((p.price - min) / range) * h).toFixed(1)}`)
    .join(' ');
  const last = prices[prices.length - 1] ?? 0;
  const first = prices[0] ?? 0;
  const trendColor = last > first ? '#10b981' : last < first ? '#f43f5e' : '#94a3b8';
  return (
    <svg
      width={w}
      height={h}
      className="opacity-70"
      aria-label={`${history.length} точек, min ${min}₽ / max ${max}₽`}
    >
      <title>{`${history.length} точек · min ${min}₽ · max ${max}₽`}</title>
      <polyline points={points} fill="none" stroke={trendColor} strokeWidth="1" />
    </svg>
  );
}
