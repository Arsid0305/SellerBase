import Link from 'next/link';
import { AlertCircle, PackageX, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import type { CriticalSku, CriticalReason } from '@/entities/critical-skus';

const REASON_META: Record<CriticalReason, { label: string; hint: string; Icon: typeof PackageX; tone: string }> = {
  out_of_stock_selling: {
    label: 'Закончился остаток',
    hint: 'Товар продаётся, но запас = 0. Упускаем заказы.',
    Icon: PackageX,
    tone: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  no_sales_14d: {
    label: 'Висит без продаж 14+ дней',
    hint: 'Запас есть, но покупателей нет. Склад замораживает деньги.',
    Icon: Clock,
    tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  other: {
    label: 'Другое',
    hint: 'Другая причина критичного состояния.',
    Icon: AlertCircle,
    tone: 'bg-muted text-muted-foreground border-border',
  },
};

function formatUnitsPerDay(v: number): string {
  if (v === 0) return '0';
  if (v < 1) return v.toFixed(2);
  return v.toFixed(1);
}

export function CriticalSkusTable({ rows }: { rows: CriticalSku[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Критичных SKU нет — все товары в норме.
        </CardContent>
      </Card>
    );
  }

  const grouped = rows.reduce<Record<CriticalReason, CriticalSku[]>>(
    (acc, r) => {
      acc[r.reason].push(r);
      return acc;
    },
    { out_of_stock_selling: [], no_sales_14d: [], other: [] },
  );

  return (
    <div className="flex flex-col gap-4">
      {(Object.keys(grouped) as CriticalReason[]).map((reason) => {
        const items = grouped[reason];
        if (items.length === 0) return null;
        const meta = REASON_META[reason];
        const Icon = meta.Icon;
        return (
          <Card key={reason}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className={`inline-flex size-7 items-center justify-center rounded-md border ${meta.tone}`}>
                  <Icon className="size-4" />
                </span>
                {meta.label}
                <span className="text-sm font-normal text-muted-foreground">· {items.length} шт</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{meta.hint}</p>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium">Товар</th>
                    <th className="py-2 pr-4 font-medium tabular-nums">Остаток</th>
                    <th className="py-2 pr-4 font-medium tabular-nums">Шт/день</th>
                    <th className="py-2 pr-4 font-medium tabular-nums">Дней без продаж</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.skuId} className="border-b border-border/50 last:border-b-0">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/products/${s.skuId}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <SkuThumb src={s.photoUrl} alt={s.title} />
                          <div className="flex min-w-0 flex-col">
                            <span className="line-clamp-1">{s.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {s.myArticle ?? (s.wbArticle != null ? String(s.wbArticle) : '—')}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{s.stock.toLocaleString('ru-RU')}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatUnitsPerDay(s.unitsPerDay)}</td>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                        {s.daysSinceLastSale != null ? s.daysSinceLastSale : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
