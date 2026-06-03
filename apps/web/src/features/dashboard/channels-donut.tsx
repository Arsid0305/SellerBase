import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatRub, formatDelta } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { ChannelShare } from './types';

const SIZE = 200;
const R_OUTER = 80;
const R_INNER = 56;

const PALETTE: Record<ChannelShare['channel'], string> = {
  WB: 'fill-fuchsia-500',
  OZON: 'fill-sky-500',
};

const PALETTE_DOT: Record<ChannelShare['channel'], string> = {
  WB: 'bg-fuchsia-500',
  OZON: 'bg-sky-500',
};

function arcPath(startAngle: number, endAngle: number) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const a0 = (startAngle - 90) * (Math.PI / 180);
  const a1 = (endAngle - 90) * (Math.PI / 180);
  const x0 = cx + R_OUTER * Math.cos(a0);
  const y0 = cy + R_OUTER * Math.sin(a0);
  const x1 = cx + R_OUTER * Math.cos(a1);
  const y1 = cy + R_OUTER * Math.sin(a1);
  const xi0 = cx + R_INNER * Math.cos(a0);
  const yi0 = cy + R_INNER * Math.sin(a0);
  const xi1 = cx + R_INNER * Math.cos(a1);
  const yi1 = cy + R_INNER * Math.sin(a1);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${R_INNER} ${R_INNER} 0 ${large} 0 ${xi0} ${yi0} Z`;
}

export function ChannelsDonut({ channels }: { channels: ChannelShare[] }) {
  const total = channels.reduce((acc, c) => acc + c.amount, 0);
  let cursor = 0;
  const segments = channels.map((c) => {
    const angle = (c.share / 100) * 360;
    const path = arcPath(cursor, cursor + angle);
    cursor += angle;
    return { ...c, path };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Доля каналов по продажам</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative shrink-0">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
            {segments.map((s) => (
              <path key={s.channel} d={s.path} className={PALETTE[s.channel]} />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-muted-foreground">Всего</span>
            <span className="text-lg font-semibold tracking-tight">{formatRub(total)}</span>
          </div>
        </div>
        <ul className="flex w-full flex-col gap-3">
          {channels.map((c) => {
            const TrendIcon = c.delta > 0 ? ArrowUpRight : c.delta < 0 ? ArrowDownRight : Minus;
            const trendTone =
              c.delta > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : c.delta < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-muted-foreground';
            return (
              <li key={c.channel} className="flex items-center justify-between gap-4 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn('size-2.5 rounded-full', PALETTE_DOT[c.channel])} />
                  <span className="truncate font-medium">{c.label}</span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="tabular-nums text-muted-foreground">{formatRub(c.amount)}</span>
                  <span className="w-10 tabular-nums font-semibold">{c.share}%</span>
                  <span className={cn('inline-flex w-12 items-center justify-end gap-0.5 tabular-nums', trendTone)}>
                    <TrendIcon className="size-3.5" />
                    {formatDelta(c.delta)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
