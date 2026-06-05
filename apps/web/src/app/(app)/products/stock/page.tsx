import { PageHeader } from '@/widgets/app-shell/page-header';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { fetchExternalStock } from '@/entities/external-stock';
import { ExternalStockTable, type ExternalStockRow } from '@/features/supplies/external-stock-table';

export const metadata = { title: 'Остатки дома и в ФФ' };
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

  const byId = new Map<number, { home: number; ff: number }>();
  for (const r of ext) {
    const cur = byId.get(r.skuId) ?? { home: 0, ff: 0 };
    if (r.location === 'home') cur.home = r.quantity;
    else if (r.location === 'ff') cur.ff = r.quantity;
    byId.set(r.skuId, cur);
  }

  const rows: ExternalStockRow[] = ((skus ?? []) as SkuRow[]).map((s) => ({
    skuId: s.id,
    myArticle: s.my_article,
    barcode: s.barcode,
    title: s.title,
    home: byId.get(s.id)?.home ?? 0,
    ff: byId.get(s.id)?.ff ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Остатки дома и в ФФ"
        description="Запас вне WB — учитывается при расчёте рекомендаций к поставке"
      />
      <ExternalStockTable rows={rows} />
    </div>
  );
}
