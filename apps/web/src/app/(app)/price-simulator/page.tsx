import { PageHeader } from '@/widgets/app-shell/page-header';
import { PlatformTabs } from '@/shared/ui/platform-tabs';
import { PriceSimulatorClient } from '@/features/price-simulator';
import { fetchPriceSimulatorRows } from '@/entities/price-simulator';
import { PriceProblemsTable, PriceEconomicsTable } from '@/features/ozon-prices';
import { fetchOzonPriceProblems, fetchOzonPrices } from '@/entities/ozon-prices';

export const metadata = { title: 'Цены' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PriceSimulatorPage() {
  const [rows, problems, ozonRows] = await Promise.all([
    fetchPriceSimulatorRows(),
    fetchOzonPriceProblems(),
    fetchOzonPrices(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Цены"
        description="Wildberries - подвигать цену и увидеть маржу. Ozon - сколько площадка забирает по нынешним ценам."
      />
      <PlatformTabs
        ozonBadge={problems.length}
        wb={<PriceSimulatorClient rows={rows} />}
        ozon={
          <div className="flex flex-col gap-6">
            <PriceProblemsTable rows={problems} />
            <PriceEconomicsTable rows={ozonRows} />
            <p className="text-xs text-muted-foreground">
              Ползунок цены пока только для Wildberries. По Ozon показан расчёт по
              тем ценам, что стоят в кабинете сейчас; числа обновляются дважды в
              день.
            </p>
          </div>
        }
      />
    </div>
  );
}
