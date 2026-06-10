import { PageHeader } from '@/widgets/app-shell/page-header';
import {
  AdsKpis,
  CampaignsTable,
  PromotedProductsTable,
  mockAdsKpis,
  mockCampaigns,
  mockPromotedProducts,
} from '@/features/ads';

export const metadata = { title: 'Реклама товаров' };

export default function AdsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Реклама товаров"
        description="Рекламные кампании WB/Ozon, расход, окупаемость, отдача на товар"
      />
      <AdsKpis kpis={mockAdsKpis} />
      <CampaignsTable campaigns={mockCampaigns} />
      <PromotedProductsTable products={mockPromotedProducts} />
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальные данные из WB Statistics API + Ozon Performance API подключатся после согласования API-ключей.
      </p>
    </div>
  );
}
