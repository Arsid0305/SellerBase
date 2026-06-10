import { KpiCard } from '@/shared/ui/domain/kpi-card';
import { formatRub } from '@/shared/lib/format';
import type { AdsKpis } from './types';

export function AdsKpis({ kpis }: { kpis: AdsKpis }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Бюджет"
        value={formatRub(kpis.budget)}
        delta={kpis.budgetDelta}
        deltaLabel="vs прошлый период"
        series={kpis.spendSeries}
        hint="Расход на рекламу за период"
        trend={kpis.budgetDelta > 0 ? 'up' : kpis.budgetDelta < 0 ? 'down' : 'flat'}
      />
      <KpiCard
        label="CPC"
        value={`${kpis.cpc.toFixed(2)} ₽`}
        delta={kpis.cpcDelta}
        deltaLabel="vs прошлый период"
        series={kpis.cpcSeries}
        hint="Средняя цена клика"
        trend={kpis.cpcDelta < 0 ? 'up' : kpis.cpcDelta > 0 ? 'down' : 'flat'}
      />
      <KpiCard
        label="CR"
        value={`${kpis.conversionRate.toFixed(2)}%`}
        delta={kpis.conversionRateDelta}
        deltaLabel="vs прошлый период"
        series={kpis.crSeries}
        hint="Конверсия клика в заказ"
        trend={kpis.conversionRateDelta > 0 ? 'up' : kpis.conversionRateDelta < 0 ? 'down' : 'flat'}
      />
      <KpiCard
        label="ROAS"
        value={`${kpis.roas.toFixed(2)}×`}
        delta={kpis.roasDelta}
        deltaLabel="vs прошлый период"
        series={kpis.roasSeries}
        hint="Окупаемость: выручка / расход"
        trend={kpis.roasDelta > 0 ? 'up' : kpis.roasDelta < 0 ? 'down' : 'flat'}
      />
    </div>
  );
}
