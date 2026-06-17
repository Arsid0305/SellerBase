import { PageHeader } from '@/widgets/app-shell/page-header';
import { DataQualityCards } from '@/features/data-quality';
import { fetchDataQuality } from '@/entities/data-quality';

export const metadata = { title: 'Качество данных' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DataQualityPage() {
  const report = await fetchDataQuality();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Качество данных"
        description="Единое окно: что не в порядке с каталогом, продажами и синхронизацией"
      />
      <DataQualityCards report={report} />
      <p className="text-xs text-muted-foreground">
        · Данные из `sku_catalog`, `wb_reports_fact`, `wb_sales_fact`, `wb_stocks`, `ingestion_log`. Активный SKU — есть продажи за 30 дней или остаток &gt; 0. Обновлено на {report.generatedAt}.
      </p>
    </div>
  );
}
