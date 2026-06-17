import { PageHeader } from '@/widgets/app-shell/page-header';
import { MarginAnalyzerTable } from '@/features/margin-analyzer-v2';
import { fetchMarginAnalysis } from '@/entities/margin-analyzer-v2';

export const metadata = { title: 'Анализатор маржи: почему падает' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MarginAnalyzerPage() {
  const rows = await fetchMarginAnalysis();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Анализатор маржи: почему падает"
        description="Текущие 30 дней vs предыдущие 30 дней — что именно съело маржу по каждому товару"
      />
      <MarginAnalyzerTable rows={rows} />
    </div>
  );
}
