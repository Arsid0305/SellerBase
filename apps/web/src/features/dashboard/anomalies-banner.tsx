import Link from 'next/link';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import type { Anomaly } from '@/entities/anomalies';

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y?.slice(2)}`;
}

export function AnomaliesBanner({ anomalies }: { anomalies: Anomaly[] }) {
  if (anomalies.length === 0) return null;
  return (
    <Card className="border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-4" />
        <span>Аномалии в продажах</span>
        <span className="text-xs text-muted-foreground">· z-score &gt; 2σ от 30-дневного среднего</span>
      </div>
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {anomalies.map((a) => {
          const Icon = a.direction === 'spike' ? TrendingUp : TrendingDown;
          const color = a.direction === 'spike' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
          return (
            <li key={`${a.barcode}-${a.date}`} className="flex items-start gap-2 text-sm">
              <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
              <Link href={`/products/${encodeURIComponent(a.barcode)}`} className="min-w-0 flex-1 hover:underline">
                <div className="truncate font-medium">{a.title}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {formatDate(a.date)} · {a.units} шт против {a.baseline} среднее (z={a.zScore})
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
