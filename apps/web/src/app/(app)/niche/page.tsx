import { PageHeader } from '@/widgets/app-shell/page-header';
import {
  NicheKpis,
  CategoriesTable,
  BrandsTable,
  QueriesTable,
  mockNicheKpis,
  mockCategories,
  mockBrands,
  mockQueries,
} from '@/features/niche';

export const metadata = { title: 'Поиск ниши WB' };

export default function NichePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Поиск ниши WB"
        description="Анализ категорий, брендов и поисковых запросов в Wildberries"
      />
      <NicheKpis kpis={mockNicheKpis} />
      <CategoriesTable categories={mockCategories} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BrandsTable brands={mockBrands} />
        <QueriesTable queries={mockQueries} />
      </div>
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальные данные требуют скрапинг или WB Internal API — подключатся
        после согласования источника.
      </p>
    </div>
  );
}
