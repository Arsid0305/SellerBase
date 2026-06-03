import { PageHeader } from '@/widgets/app-shell/page-header';
import { CatalogExplorer, mockCatalog } from '@/features/catalog';

export const metadata = { title: 'Мои товары' };

export default function CatalogPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Мои товары"
        description="Полный каталог SKU с остатками, продажами и маржой"
      />
      <CatalogExplorer rows={mockCatalog} />
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальный каталог из `sku_catalog` + агрегации продаж подключится в следующем PR.
      </p>
    </div>
  );
}
