import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { formatRub } from '@/shared/lib/format';
import type { TopProductRow } from '@/entities/pnl';

export function TopProductsCard({ rows }: { rows: TopProductRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Топ-5 товаров</CardTitle>
        <span className="text-xs text-muted-foreground">По обороту за выбранный период</span>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Нет продаж за период</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.skuId} className="flex items-center gap-3">
                <SkuThumb src={r.photoUrl} alt={r.title} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${encodeURIComponent(String(r.skuId))}`}
                    className="truncate text-sm font-medium hover:underline"
                    title={r.title}
                  >
                    {r.title}
                  </Link>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {r.unitsSold.toLocaleString('ru-RU')} шт · {r.share.toFixed(1).replace(/\.0$/, '')}%
                  </div>
                </div>
                <div className="text-right text-sm font-semibold tabular-nums">
                  {formatRub(r.revenue)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
