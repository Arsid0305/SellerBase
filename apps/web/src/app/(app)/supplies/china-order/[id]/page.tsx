import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { fetchChinaOrders, fetchChinaOrderItems } from '@/entities/china-orders';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const nf = new Intl.NumberFormat('ru-RU');
const rub = (v: number) => `${nf.format(Math.round(v))} ₽`;

function formatDate(v: string | null): string {
  if (!v) return '—';
  const [y, m, d] = v.split('-');
  return d && m && y ? `${d}.${m}.${y}` : v;
}

export default async function ChinaOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  const [orders, items] = await Promise.all([fetchChinaOrders(), fetchChinaOrderItems(orderId)]);
  const order = orders.find((o) => o.id === orderId);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/supplies/china-order"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Все заказы
        </Link>
        <PageHeader
          title={`Заказ от ${formatDate(order.orderDate)}`}
          description={order.supplier ?? 'Поставщик не указан'}
        />
      </div>

      {order.comment && (
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">{order.comment}</div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Позиций</div>
          <div className="text-xl font-semibold tabular-nums">{order.positions}</div>
        </div>
        <div className="rounded-md border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Штук</div>
          <div className="text-xl font-semibold tabular-nums">{nf.format(order.units)}</div>
        </div>
        <div className="rounded-md border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Вес, кг</div>
          <div className="text-xl font-semibold tabular-nums">{order.weightKg.toFixed(1)}</div>
        </div>
        <div className="rounded-md border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Сумма товара</div>
          <div className="text-xl font-semibold tabular-nums">{rub(order.sumRub)}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Артикул</th>
              <th className="px-3 py-2 text-left font-medium">Название</th>
              <th className="px-3 py-2 text-right font-medium">Заказано</th>
              <th className="px-3 py-2 text-right font-medium">Отгружено</th>
              <th className="px-3 py-2 text-right font-medium">Цена ¥</th>
              <th className="px-3 py-2 text-right font-medium">Сумма ¥</th>
              <th className="px-3 py-2 text-right font-medium">Сумма ₽</th>
              <th className="px-3 py-2 text-right font-medium">Вес ед.</th>
              <th className="px-3 py-2 text-right font-medium">Вес, кг</th>
              <th className="px-3 py-2 text-right font-medium">В коробе</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{it.myArticle ?? '—'}</td>
                <td className="px-3 py-2">
                  {it.supplierUrl ? (
                    <a href={it.supplierUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      {it.name ?? '—'}
                    </a>
                  ) : (
                    (it.name ?? '—')
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{nf.format(it.qtyOrdered)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{nf.format(it.qtyShipped)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{it.priceYuan.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{nf.format(Math.round(it.sumYuan))}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{rub(it.sumRub)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{it.unitWeightKg.toFixed(3)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{it.totalWeightKg.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{it.packageNorm ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        · Позиция без артикула — упаковочный материал, он в каталоге товаров не заводится.
      </p>
    </div>
  );
}
