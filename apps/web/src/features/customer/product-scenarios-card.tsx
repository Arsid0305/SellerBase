import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import {
  fetchScenariosBySkuId,
  LEVEL_LABEL,
  type Level3,
} from '@/entities/customer';

const LEVEL_TONE: Record<Level3, string> = {
  low: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  med: 'border-sky-200 bg-sky-50 text-sky-700',
  high: 'border-rose-200 bg-rose-50 text-rose-700',
};

export async function ProductScenariosCard({ skuId }: { skuId: number }) {
  if (!Number.isFinite(skuId)) return null;
  const scenarios = await fetchScenariosBySkuId(skuId);
  if (scenarios.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-neutral-900">Покрываемые сценарии покупки</h3>
        <span className="text-xs text-neutral-400">({scenarios.length})</span>
      </div>
      <ul className="flex flex-col gap-2">
        {scenarios.map((s) => {
          const pct = Math.max(0, Math.min(1, s.fitScore)) * 100;
          return (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white p-2"
            >
              <Link
                href={`/scenarios/${s.id}`}
                className="flex min-w-0 flex-1 flex-col truncate hover:text-neutral-950"
              >
                <span className="truncate text-sm font-medium text-neutral-800">{s.title}</span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  <Badge variant="outline" className={cn('text-[10px]', LEVEL_TONE[s.urgency])}>
                    Срочность: {LEVEL_LABEL[s.urgency]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn('text-[10px]', LEVEL_TONE[s.priceSensitivity])}
                  >
                    Цена: {LEVEL_LABEL[s.priceSensitivity]}
                  </Badge>
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs tabular-nums text-neutral-500">{s.fitScore.toFixed(2)}</span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
