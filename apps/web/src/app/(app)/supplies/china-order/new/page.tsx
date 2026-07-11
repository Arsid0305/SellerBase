import { PageHeader } from '@/widgets/app-shell/page-header';
import { ChinaOrderForm } from '@/features/china-order/china-order-form';

export const metadata = { title: 'Новый заказ Китая' };
export const dynamic = 'force-dynamic';

export default function NewChinaOrderPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Новый заказ Китая"
        description="Форма 1:1 из Excel — ссылка 1688, кол-во, цена ¥, доставка ¥, артикулы. Курс и дата в шапке."
      />
      <ChinaOrderForm />
    </div>
  );
}
