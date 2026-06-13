import { notFound } from 'next/navigation';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { fetchPromoDetail } from '@/entities/promo';
import { PromoDetailClient } from '@/features/promo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PromoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const promotionId = Number(id);
  if (!Number.isFinite(promotionId)) notFound();

  const { promo, rows } = await fetchPromoDetail(promotionId);
  if (!promo) notFound();

  const start = new Date(promo.startAt).toLocaleDateString('ru-RU');
  const end = new Date(promo.endAt).toLocaleDateString('ru-RU');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={promo.name}
        description={`${start} – ${end} · ${promo.skuCount} SKU · ${promo.type === 'auto' ? 'Авто-акция' : 'Стандартная'}`}
      />
      <PromoDetailClient promo={promo} rows={rows} isAutoPromo={promo.type === 'auto'} />
    </div>
  );
}
