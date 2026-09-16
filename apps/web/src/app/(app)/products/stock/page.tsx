import { PageHeader } from '@/widgets/app-shell/page-header';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { fetchExternalStock } from '@/entities/external-stock';
import { ExternalStockTable, type ExternalStockRow } from '@/features/supplies/external-stock-table';

export const metadata = { title: 'Остаток на фулфилменте' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SkuRow = {
  id: number;
  my_article: string | null;
  barcode: string | null;
  title: string | null;
};

export default async function ExternalStockPage() {
  const supabase = createAdminClient();
  const [{ data: skus }, ext] = await Promise.all([
    supabase
      .from('sku_catalog')
      .select('id, my_article, barcode, title')
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(0, 5000),
    fetchExternalStock(),
  ]);

  // Дома остатков нет: то, что не ушло по ФБО, остаётся на фулфилменте
  // и оттуда продаётся по ФБС. Поэтому одно число на товар, а не два.
  const ffById = new Map<number, number>();
  for (const r of ext) {
    if (r.location === 'ff') ffById.set(r.skuId, r.quantity);
  }

  const rows: ExternalStockRow[] = ((skus ?? []) as SkuRow[]).map((s) => ({
    skuId: s.id,
    myArticle: s.my_article,
    barcode: s.barcode,
    title: s.title,
    ff: ffById.get(s.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Остаток на фулфилменте"
        description="Это и есть склад ФБС: что не отгрузилось по ФБО, остаётся на фулфилменте и продаётся оттуда"
      />
      <ExternalStockTable rows={rows} />
    </div>
  );
}
