import { cn } from '@/shared/lib/utils';

export type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  trend?: 'up' | 'down' | 'flat';
};

/**
 * Sparkline — микро-график для KPI-карточек, рисуется поверх SVG без внешних зависимостей.
 */
export function Sparkline({ data, width = 96, height = 28, className, trend = 'flat' }: SparklineProps) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;

  const points = data.map((value, i) => {
    const x = i * step;
    const y = height - ((value - min) / range) * height;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => (i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`))
    .join(' ');

  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  const stroke =
    trend === 'up'
      ? 'stroke-emerald-500'
      : trend === 'down'
        ? 'stroke-rose-500'
        : 'stroke-muted-foreground';

  const fill =
    trend === 'up' ? 'fill-emerald-500/10' : trend === 'down' ? 'fill-rose-500/10' : 'fill-muted-foreground/10';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('block', className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={areaPath} className={fill} strokeWidth="0" />
      <path d={path} className={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
