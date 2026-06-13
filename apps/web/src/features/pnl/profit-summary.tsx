import { KpiCard } from '@/shared/ui/domain/kpi-card';
import { formatRub } from '@/shared/lib/format';
import type { PnlKpis } from './types';

export function ProfitSummary({
  kpis,
  comparisonLabel,
}: {
  kpis: PnlKpis;
  comparisonLabel: string;
}) {
  const deltaLabel = `vs ${comparisonLabel}`;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Доходы"
        value={formatRub(kpis.revenue.value)}
        delta={kpis.revenue.delta}
        deltaLabel={deltaLabel}
        series={kpis.revenue.series}
      />
      <KpiCard
        label="Расходы"
        value={formatRub(kpis.expenses.value)}
        delta={kpis.expenses.delta}
        deltaLabel={deltaLabel}
        series={kpis.expenses.series}
        trend={
          kpis.expenses.delta < 0 ? 'up' : kpis.expenses.delta > 0 ? 'down' : 'flat'
        }
      />
      <KpiCard
        label="Прибыль"
        value={formatRub(kpis.profit.value)}
        delta={kpis.profit.delta}
        deltaLabel={deltaLabel}
        series={kpis.profit.series}
      />
      <KpiCard
        label="Маржа"
        value={`${(kpis.margin.value ?? 0).toFixed(1)}%`}
        delta={kpis.margin.delta}
        deltaLabel={deltaLabel}
        series={kpis.margin.series}
        hint={
          kpis.margin.delta > 0
            ? 'Выше прошлого периода'
            : kpis.margin.delta < 0
              ? 'Ниже прошлого периода'
              : 'Без изменений'
        }
      />
    </div>
  );
}
