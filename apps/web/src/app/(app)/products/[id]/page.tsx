import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { ProductTagBadge } from '@/shared/ui/domain/product-tag-badge';
import {
  ProductMetaCard,
  ProductSalesCard,
  ProductFinanceCard,
  ProductExpensesCard,
  ProductWarehousesCard,
  ProductPhotosCard,
  ProductEventsCard,
  ProductHistoryCard,
  ProductTabs,
  RevenueByDayChart,
  StockByDayChart,
} from '@/features/product-detail';
import { fetchProductDetailByBarcode } from '@/entities/product-detail';
import { fetchProductEvents } from '@/entities/events';
import { fetchSnapshotsBySkuId } from '@/entities/snapshots';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const product = await fetchProductDetailByBarcode(decodeURIComponent(id));
  return { title: product?.name ?? 'Товар' };
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const [product, events] = await Promise.all([
    fetchProductDetailByBarcode(decoded),
    fetchProductEvents(decoded),
  ]);
  if (!product) notFound();
  const skuId = Number(product.id);
  const diffs = Number.isFinite(skuId) ? await fetchSnapshotsBySkuId(skuId) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/products" className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="size-4" />
          Мои товары
        </Link>
        <span>·</span>
        <span className="truncate font-medium text-foreground">{product.name}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge
              variant="outline"
              className={
                product.meta.inStock
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400'
              }
            >
              {product.meta.inStock ? '• В стоке' : '• Нет в стоке'}
            </Badge>
            <Badge variant="outline" className="border-fuchsia-500/40 bg-fuchsia-500/10 font-mono text-[10px] text-fuchsia-700 dark:text-fuchsia-400">
              {product.channel}
            </Badge>
            {product.tags.map((t) => (
              <ProductTagBadge key={t} kind={t} />
            ))}
            <span className="font-mono text-xs text-muted-foreground">{product.meta.barcode}</span>
          </div>
        </div>
      </div>

      <ProductTabs />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        <ProductMetaCard product={product} />
        <ProductSalesCard product={product} />
        <ProductFinanceCard product={product} />
        <ProductPhotosCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductExpensesCard product={product} />
        <ProductWarehousesCard product={product} />
      </div>

      <ProductEventsCard events={events} />

      <ProductHistoryCard diffs={diffs} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RevenueByDayChart data={product.revenueByDay} />
        <StockByDayChart data={product.stockByDay} />
      </div>

      <p className="text-xs text-muted-foreground">
        · Данные из `sku_catalog` + RPC `get_full_pnl_by_period` + `wb_reports_fact` (30 дней) + `wb_stocks` (текущие остатки). История остатков из `wb_stocks_history` подключится позже.
      </p>
    </div>
  );
}
