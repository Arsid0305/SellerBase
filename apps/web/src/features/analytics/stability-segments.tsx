import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import type { StabilitySegment } from './types';

const TIER_COLOR: Record<StabilitySegment['tier'], string> = {
  X: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
  Y: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300',
  Z: 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300',
};

export function StabilitySegments({ segments }: { segments: StabilitySegment[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Анализ товаров по оборачиваемости</CardTitle>
        <p className="text-xs text-muted-foreground">XYZ-классификация по стабильности продаж</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {segments.map((s) => {
            const cardClass = cn(
              'flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:brightness-105',
              TIER_COLOR[s.tier],
            );
            const body = (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-background/60 text-sm font-semibold">
                    {s.tier}
                  </span>
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{s.count} шт.</span>
                  <span className="text-sm opacity-80">{s.share.toFixed(1)}%</span>
                </div>
                <span className="text-[11px] opacity-80">{s.description}</span>
              </>
            );
            if (s.count > 0) {
              return (
                <Link key={s.tier} href={`/analytics/group?stability=${s.tier}`} className={cardClass}>
                  {body}
                </Link>
              );
            }
            return (
              <div key={s.tier} className={cardClass}>
                {body}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
