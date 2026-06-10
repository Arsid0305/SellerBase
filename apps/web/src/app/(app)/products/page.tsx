import { PageHeader } from '@/widgets/app-shell/page-header';
import { CatalogExplorer } from '@/features/catalog';
import { fetchCatalog, fetchCategories } from '@/entities/catalog';

export const metadata = { title: 'Мои товары' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CatalogPage() {
  const [rows, categories] = await Promise.all([fetchCatalog(), fetchCategories()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Мои товары"
        description="Полный каталог SKU с остатками, продажами и маржой"
      />
      <CatalogExplorer rows={rows} categories={categories} />
      <p className="text-xs text-muted-foreground">
        · Данные из `sku_catalog` + 30-дневная агрегация `wb_reports_fact` + `wb_stocks` + `v_supply_recommendation`.
      </p>
    </div>
  );
}
