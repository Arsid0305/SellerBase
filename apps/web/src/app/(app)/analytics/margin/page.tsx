import { PageHeader } from '@/widgets/app-shell/page-header';
import { fetchMarginAnalyzerData } from '@/entities/margin-analyzer';
import { MarginAnalyzerClient } from '@/features/margin-analyzer';

export const metadata = { title: 'Анализатор маржи' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MarginAnalyzerPage() {
  const rows = await fetchMarginAnalyzerData();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Анализатор маржи"
        description="Почему маржа падает — разбор компонентов по неделям, главный виновник за последнюю неделю"
      />
      <MarginAnalyzerClient rows={rows} />
    </div>
  );
}
