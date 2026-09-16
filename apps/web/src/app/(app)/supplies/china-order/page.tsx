import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { fetchChinaOrders } from '@/entities/china-orders';

export const metadata = { title: 'Заказы из Китая' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const nf = new Intl.NumberFormat('ru-RU');
const rub = (v: number) => `${nf.format(Math.round(v))} ₽`;

function formatDate(v: string | null): string {
  if (!v) return '—';
  const [y, m, d] = v.split('-');
  return d && m && y ? `${d}.${m}.${y}` : v;
}

export default async function ChinaOrdersPage() {
  const orders = await fetchChinaOrders();

  const totalRub = orders.reduce((a, o) => a + o.sumRub, 0);
  const totalUnits = orders.reduce((a, o) => a + o.units, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Заказы из Китая" description="Что заказано у поставщиков, по партиям" />
        <Link
          href="/supplies/china-order/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          <Plus className="size-4" />
          Новый заказ
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Заказов пока нет.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">Заказов</div>
              <div className="text-xl font-semibold tabular-nums">{orders.length}</div>
            </div>
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">Штук всего</div>
              <div className="text-xl font-semibold tabular-nums">{nf.format(totalUnits)}</div>
            </div>
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">На сумму</div>
              <div className="text-xl font-semibold tabular-nums">{rub(totalRub)}</div>
            </div>
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">Последний заказ</div>
              <div className="text-xl font-semibold tabular-nums">{formatDate(orders[0]?.orderDate ?? null)}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Дата</th>
                  <th className="px-3 py-2 text-left font-medium">Поставщик</th>
                  <th className="px-3 py-2 text-right font-medium">Позиций</th>
                  <th className="px-3 py-2 text-right font-medium">Штук</th>
                  <th className="px-3 py-2 text-right font-medium">Вес, кг</th>
                  <th className="px-3 py-2 text-right font-medium">Курс ¥</th>
                  <th className="px-3 py-2 text-right font-medium">Сумма ¥</th>
                  <th className="px-3 py-2 text-right font-medium">Сумма ₽</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link href={`/supplies/china-order/${o.id}`} className="font-medium hover:underline">
                        {formatDate(o.orderDate)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{o.supplier ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{o.positions}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nf.format(o.units)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{o.weightKg.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{o.cnyRate.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nf.format(Math.round(o.sumYuan))}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{rub(o.sumRub)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        · Суммы в рублях считаются по курсу юаня, записанному в заказе. Вес — фактически отгруженный.
      </p>
    </div>
  );
}
