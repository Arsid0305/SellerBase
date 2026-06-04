import { Layers, Tag, Package, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { formatInt, formatCompact } from '@/shared/lib/format';
import type { NicheKpis } from './types';

export function NicheKpis({ kpis }: { kpis: NicheKpis }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        icon={<Layers className="size-5" />}
        tone="text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-500/10"
        label="Найдено категорий"
        value={formatInt(kpis.categoriesCount)}
        hint="в скоупе анализа"
      />
      <KpiTile
        icon={<Tag className="size-5" />}
        tone="text-blue-600 dark:text-blue-400 bg-blue-500/10"
        label="Найдено брендов"
        value={formatInt(kpis.brandsCount)}
        hint="в топе по выручке"
      />
      <KpiTile
        icon={<Package className="size-5" />}
        tone="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
        label="Найдено товаров"
        value={formatCompact(kpis.productsCount)}
        hint="суммарно по категориям"
      />
      <KpiTile
        icon={<Wallet className="size-5" />}
        tone="text-amber-600 dark:text-amber-400 bg-amber-500/10"
        label="Средняя выручка категории"
        value={formatCompact(kpis.avgCategoryRevenue) + ' ₽'}
        hint="в месяц"
      />
    </div>
  );
}

function KpiTile({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className={`rounded-md p-2 ${tone}`}>{icon}</div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
      </CardContent>
    </Card>
  );
}
