import { PageHeader } from '@/widgets/app-shell/page-header';
import { TariffsExplorer, PersonalIndicesSection } from '@/features/tariffs';
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
        description="Справочник: тарифы WB по складам, возврат и динамика коэффициентов. Обновляются из WB каждый день"
      />
      <PersonalIndicesSection />
      <TariffsExplorer boxRows={boxRows} returnRows={returnRows} />
    </div>
  );
}
