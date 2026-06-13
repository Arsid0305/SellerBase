import { KpiCard } from '@/shared/ui/domain/kpi-card';
import { formatRub } from '@/shared/lib/format';
import type { DashboardSummary } from './types';

export function KpiGrid({ kpis, comparison }: { kpis: DashboardSummary['kpis']; comparison: DashboardSummary['comparison'] }) {
  const deltaLabel = `vs ${comparison.label}`;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label={kpis.revenue.label}
        value={formatRub(kpis.revenue.value)}
        delta={kpis.revenue.delta}
        deltaLabel={deltaLabel}
        series={kpis.revenue.series}
        hint={kpis.revenue.hint}
      />
      <KpiCard
        label={kpis.mainExpenses.label}
        value={formatRub(kpis.mainExpenses.value)}
        delta={kpis.mainExpenses.delta}
        deltaLabel={deltaLabel}
        series={kpis.mainExpenses.series}
        hint={kpis.mainExpenses.hint}
        trend={
          kpis.mainExpenses.delta < 0
            ? 'up'
            : kpis.mainExpenses.delta > 0
              ? 'down'
              : 'flat'
        }
      />
      <KpiCard
        label={kpis.extraExpenses.label}
        value={formatRub(kpis.extraExpenses.value)}
        delta={kpis.extraExpenses.delta}
        deltaLabel={deltaLabel}
        series={kpis.extraExpenses.series}
        hint={kpis.extraExpenses.hint}
        trend={
          kpis.extraExpenses.delta < 0
            ? 'up'
            : kpis.extraExpenses.delta > 0
              ? 'down'
              : 'flat'
        }
      />
      <KpiCard
        label={kpis.profit.label}
        value={formatRub(kpis.profit.value)}
        delta={kpis.profit.delta}
        deltaLabel={deltaLabel}
        series={kpis.profit.series}
        hint={kpis.profit.hint}
      />
    </div>
  );
}
