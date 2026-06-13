import { PageHeader } from '@/widgets/app-shell/page-header';
import { fetchPromoMatrix } from '@/entities/promo/matrix-queries';
import { PromoMatrixClient } from '@/features/promo/promo-matrix-client';

export const metadata = { title: 'Промо-акции WB' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PromoPage() {
  const { promos, skus } = await fetchPromoMatrix();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Промо-акции WB"
        description="Матрица: твои товары × активные и ближайшие (30 дней) акции. Отметка участия, расчёт маржи, экспорт цен в шаблон WB."
      />
      <PromoMatrixClient promos={promos} skus={skus} />
    </div>
  );
}
