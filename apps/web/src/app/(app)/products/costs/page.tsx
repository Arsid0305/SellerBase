import { PageHeader } from '@/widgets/app-shell/page-header';
import { fetchCostRows, fetchCurrentCargoTariff, fetchExtraTariffsCurrent } from '@/entities/costs';
import { fetchCostBreakdown } from '@/entities/cost-breakdown';
import { CostsExplorer } from '@/features/costs/costs-explorer';

export const metadata = { title: 'Себестоимость' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CostsPage() {
  const [rows, cargoTariff, breakdown, extraTariffs] = await Promise.all([
    fetchCostRows(),
    fetchCurrentCargoTariff(),
    fetchCostBreakdown(),
    fetchExtraTariffsCurrent(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Себестоимость"
        description="Ручное управление cost_price с историей версий"
      />
      <CostsExplorer rows={rows} cargoTariff={cargoTariff} breakdown={breakdown} extraTariffs={extraTariffs} />
      <p className="text-xs text-muted-foreground">
        · Источник: `sku_catalog` + `sku_cost_history`. Сохранение создаёт новую запись и автоматически закрывает предыдущую через триггер.
      </p>
    </div>
  );
}
