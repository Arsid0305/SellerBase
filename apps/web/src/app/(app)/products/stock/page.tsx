import { PageHeader } from '@/widgets/app-shell/page-header';
import { FbsStockTable } from '@/features/stock-by-article';
import { fetchFbsStock } from '@/entities/stock-by-article';

export const metadata = { title: 'Остаток на фулфилменте' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Склад ФБС. Дома остатков нет: то, что не ушло по ФБО, лежит на
 * фулфилменте и продаётся оттуда по ФБС на обеих площадках.
 *
 * Страница показывала таблицу ручного ввода, которую ни разу не заполнили,
 * поэтому в ней были одни нули. Теперь числа приходят с самих площадок.
 */
export default async function ExternalStockPage() {
  const rows = await fetchFbsStock();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Остаток на фулфилменте"
        description="Склад ФБС: товар лежит одной кучей, а каждой площадке заявляется отдельно"
      />
      <FbsStockTable rows={rows} />
    </div>
  );
}
