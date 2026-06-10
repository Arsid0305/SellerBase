import { PageHeader } from '@/widgets/app-shell/page-header';
import { TariffsExplorer } from '@/features/tariffs';
import { fetchLatestBoxTariffs, fetchLatestReturnTariffs } from '@/entities/wb-tariffs';

export const metadata = { title: 'Тарифы и коэффициенты' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TariffsPage() {
  const [boxRows, returnRows] = await Promise.all([
    fetchLatestBoxTariffs(),
    fetchLatestReturnTariffs(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Тарифы и коэффициенты"
        description="Базовые тарифы WB по складам (Common Tariffs API), возврат, динамика коэф. и личные индексы продавца"
      />
      <TariffsExplorer boxRows={boxRows} returnRows={returnRows} />
      <p className="text-xs text-muted-foreground">
        · Базовые тарифы и возврат — из `wb_tariffs_box` / `wb_tariffs_return` (обновляются ежедневно из WB Common API).
        Остальные таблицы (комиссии, штрафы, габариты) пока mock — подтянутся в следующих PR.
      </p>
    </div>
  );
}
