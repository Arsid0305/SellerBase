import { PageHeader } from '@/widgets/app-shell/page-header';
import { KpiCard } from '@/shared/ui/domain/kpi-card';
import { ParetoCurve, ParetoTable } from '@/features/pareto';
import { fetchParetoData } from '@/entities/pareto';
import { lastNDaysRange, type PeriodRange } from '@/entities/pnl';
import { formatRub } from '@/shared/lib/format';

export const metadata = { title: 'Pareto 80/20' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{ from?: string; to?: string }>;

const numberFmt = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function formatRange(range: PeriodRange): string {
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return `${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()] ?? ''}`;
  };
  return `${fmt(range.from)} — ${fmt(range.to)}`;
}

function parseRange(sp: { from?: string; to?: string }): PeriodRange {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (sp.from && sp.to && isoRe.test(sp.from) && isoRe.test(sp.to) && sp.from <= sp.to) {
    return { from: sp.from, to: sp.to };
  }
  return lastNDaysRange(30);
}

export default async function ParetoPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const data = await fetchParetoData(range);

  const { summary, items } = data;

  const topPctLabel = items.length > 0
    ? `${numberFmt.format(summary.topPctOfSkus)}% SKU даёт ${numberFmt.format(summary.topSkusContributePct)}%`
    : '—';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pareto 80/20"
        description={`Какие SKU создают основную выручку · Период: ${formatRange(range)}`}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="Топ-SKU дают выручку"
          value={topPctLabel}
          hint={`Всего SKU с продажами: ${items.length}`}
        />
        <KpiCard
          label="SKU в зоне A"
          value={String(summary.zoneACount)}
          hint="Приоритет управления — следить за остатками и маржой"
        />
        <KpiCard
          label="Sweet spot"
          value={summary.zoneAAvgRevenue > 0 ? formatRub(summary.zoneAAvgRevenue) : '—'}
          hint="Средняя выручка SKU зоны A за период"
        />
      </div>

      <ParetoCurve items={items} />

      <ParetoTable items={items} />

      <p className="text-xs text-muted-foreground">
        · Источник: RPC `get_full_pnl_by_period`. SKU отсортированы по выручке; кумулятивная доля считается нарастающим итогом. Зона A: cum ≤ 80%, B: 80–95%, C: 95–100%.
      </p>
    </div>
  );
}
