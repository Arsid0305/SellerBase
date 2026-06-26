import { PageHeader } from '@/widgets/app-shell/page-header';
import { fetchCriticalSkus } from '@/entities/critical-skus';
import { CriticalSkusTable } from '@/features/critical-skus/critical-skus-table';

export const metadata = { title: 'Критичные SKU' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CriticalSkusPage() {
  const rows = await fetchCriticalSkus();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Критичные SKU"
        description="Товары, требующие срочного решения: закончился остаток при активных продажах или нет продаж 14+ дней."
      />
      <CriticalSkusTable rows={rows} />
      <p className="text-xs text-muted-foreground">
        · Источник: `v_sku_lifecycle` (lifecycle = CRITICAL). Архивные и новые (&lt; 14 дней в каталоге) не показываются.
      </p>
    </div>
  );
}
