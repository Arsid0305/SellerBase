import { PageHeader } from '@/widgets/app-shell/page-header';
import { PlatformTabs } from '@/shared/ui/platform-tabs';
import { fetchPromoMatrix } from '@/entities/promo/matrix-queries';
import { PromoMatrixClient } from '@/features/promo/promo-matrix-client';
import { OzonActionsTable, BoostTable } from '@/features/ozon-actions';
import { fetchOzonActions, fetchOzonBoost } from '@/entities/ozon-prices';

export const metadata = { title: 'Промо-акции' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PromoPage() {
  const [{ promos, skus }, actions, boost] = await Promise.all([
    fetchPromoMatrix(),
    fetchOzonActions(),
    fetchOzonBoost(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Промо-акции"
        description="Wildberries - матрица товаров и акций с расчётом маржи. Ozon - участие в акциях и выбор между ценой и продвижением."
      />
      <PlatformTabs
        wb={<PromoMatrixClient promos={promos} skus={skus} />}
        ozon={
          <div className="flex flex-col gap-6">
            <OzonActionsTable rows={actions} />
            <BoostTable rows={boost} />
          </div>
        }
      />
    </div>
  );
}
