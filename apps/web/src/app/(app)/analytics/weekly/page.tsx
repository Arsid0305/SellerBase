import { PageHeader } from '@/widgets/app-shell/page-header';
import { Card, CardContent } from '@/shared/ui/card';
import { fetchWeeklySummary, fetchAvailableYears } from '@/entities/sku-weekly';
import { WeeklyRevenueProfitChart, WeeklyTable, YearSelector } from '@/features/weekly-analytics';
import { formatInt, formatRub } from '@/shared/lib/format';

export const metadata = { title: 'Аналитика по неделям' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{ year?: string }>;

export default async function WeeklyAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const { year: yearParam } = await searchParams;
  const years = await fetchAvailableYears();
  const requested = Number(yearParam);
  const year = Number.isFinite(requested) && requested > 0 ? requested : (years[0] ?? 2026);
  const rows = await fetchWeeklySummary(year);

  const totals = rows.reduce(
    (acc, r) => {
      acc.units += r.units_sold;
      acc.revenue += r.revenue;
      acc.profit += r.profit;
      return acc;
    },
    { units: 0, revenue: 0, profit: 0 },
  );
  const margin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Аналитика по неделям"
        description="Динамика выручки, прибыли и оборачиваемости понедельно"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <YearSelector years={years} current={year} />
        <span className="text-xs text-muted-foreground">
          Недель с данными: {rows.length} · Источник: UNIT_WB по неделям {year}.xlsx
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Единиц продано</p>
            <p className="mt-1 text-2xl font-semibold">{formatInt(totals.units)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Выручка</p>
            <p className="mt-1 text-2xl font-semibold">{formatRub(totals.revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Прибыль</p>
            <p className={`mt-1 text-2xl font-semibold ${totals.profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatRub(totals.profit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Маржа</p>
            <p className="mt-1 text-2xl font-semibold">{margin.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <WeeklyRevenueProfitChart data={rows} />
      <WeeklyTable rows={rows} year={year} />

      <p className="text-xs text-muted-foreground">
        · Данные из `sku_weekly_metrics`, импортированы из файла UNIT_WB по неделям 2026.xlsx
      </p>
    </div>
  );
}
