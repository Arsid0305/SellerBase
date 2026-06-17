import { PageHeader } from '@/widgets/app-shell/page-header';
import { PriceSimulatorClient } from '@/features/price-simulator';
import { fetchPriceSimulatorRows } from '@/entities/price-simulator';

export const metadata = { title: 'Симулятор цены' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PriceSimulatorPage() {
  const rows = await fetchPriceSimulatorRows();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Симулятор цены"
        description="Выберите товар и подвигайте цену, чтобы увидеть маржу и прибыль"
      />
      <PriceSimulatorClient rows={rows} />
    </div>
  );
}
