import { PageHeader } from '@/widgets/app-shell/page-header';
import { fetchPromoList } from '@/entities/promo';
import { PromoListClient } from '@/features/promo';

export const metadata = { title: 'Промо-акции WB' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PromoPage() {
  const promos = await fetchPromoList();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Промо-акции WB"
        description="Календарь акций, расчёт маржи и оборачиваемости, отметка участия, экспорт цен в шаблон WB"
      />
      <PromoListClient promos={promos} />
    </div>
  );
}
