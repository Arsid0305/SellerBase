import { Card } from '@/shared/ui/card';
import type { CategoryPnlRow } from '@/entities/pnl';

function fmtMoney(v: number): string {
  return `₽${Math.round(v).toLocaleString('ru-RU')}`;
}

export function CategoriesCard({ rows }: { rows: CategoryPnlRow[] }) {
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <div className="mb-2 text-sm font-medium">По категориям</div>
        <div className="text-sm text-muted-foreground">Нет данных за период.</div>
      </Card>
    );
  }
  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-medium">По категориям · 30 дней</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Категория</th>
              <th className="py-2 pr-4 text-right font-medium">Выручка</th>
              <th className="py-2 pr-4 text-right font-medium">Доля</th>
              <th className="py-2 text-right font-medium">Маржа</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category} className="border-b border-border/40 last:border-0">
                <td className="py-2 pr-4">{r.category}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{fmtMoney(r.revenue)}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{r.share.toFixed(1)}%</td>
                <td className="py-2 text-right tabular-nums">{r.marginPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
