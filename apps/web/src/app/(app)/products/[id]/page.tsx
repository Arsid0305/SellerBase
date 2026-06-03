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
  ProductTabs,
  RevenueByDayChart,
  StockByDayChart,
  buildProductDetailById,
} from '@/features/product-detail';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const product = buildProductDetailById(id);
  return { title: product.name };
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const product = buildProductDetailById(id);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/analytics" className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="size-4" />
          Товары
        </Link>
        <span>·</span>
        <span className="truncate font-medium text-foreground">{product.name}</span>
      </div>

      {/* Title row */}
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
            <Badge
              variant="outline"
              className="font-mono text-[10px] border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400"
            >
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

      {/* Top cards row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        <ProductMetaCard product={product} />
        <ProductSalesCard product={product} />
        <ProductFinanceCard product={product} />
        <ProductPhotosCard />
      </div>

      {/* Bottom cards row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductExpensesCard product={product} />
        <ProductWarehousesCard product={product} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RevenueByDayChart data={product.revenueByDay} />
        <StockByDayChart data={product.stockByDay} />
      </div>

      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальные по товару с историей, запросами и регионами подключатся в следующих PR.
      </p>
    </div>
  );
}
