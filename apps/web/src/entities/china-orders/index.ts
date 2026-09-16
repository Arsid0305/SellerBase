import { createAdminClient } from '@/shared/lib/supabase/admin';

export type ChinaOrderRow = {
  id: number;
  orderDate: string | null;
  supplier: string | null;
  status: string | null;
  cnyRate: number;
  comment: string | null;
  positions: number;
  units: number;
  sumYuan: number;
  sumRub: number;
  weightKg: number;
  usdRate: number;
  servicesYuan: number;
  chinaDeliveryYuan: number;
  totalWeightKg: number;
  freightUsdPerKg: number;
  freightRub: number;
  moscowDeliveryRub: number;
};

export type ChinaOrderItemRow = {
  id: number;
  myArticle: string | null;
  wbArticle: number | null;
  name: string | null;
  supplierUrl: string | null;
  qtyOrdered: number;
  qtyShipped: number;
  priceYuan: number;
  sumYuan: number;
  sumRub: number;
  deliveryYuan: number;
  unitWeightKg: number;
  totalWeightKg: number;
  packageNorm: number | null;
  boxSize: string | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type ItemDb = {
  order_id: number;
  qty_ordered: number | null;
  sum_yuan: number | null;
  total_weight_kg: number | null;
};

/** Список заказов из Китая, свежие сверху, с итогами по позициям. */
export async function fetchChinaOrders(): Promise<ChinaOrderRow[]> {
  const supabase = createAdminClient();

  const [{ data: orders, error: e1 }, { data: items, error: e2 }] = await Promise.all([
    supabase
      .from('china_orders')
      .select('id, order_date, supplier_name, status, cny_rate, comment, usd_rate_rub, services_yuan, china_delivery_yuan, total_weight_kg, freight_usd_per_kg, freight_rub, moscow_delivery_rub')
      .order('order_date', { ascending: false }),
    supabase.from('china_order_items').select('order_id, qty_ordered, sum_yuan, total_weight_kg').range(0, 5000),
  ]);

  if (e1) {
    console.error('[fetchChinaOrders] orders', e1);
    return [];
  }
  if (e2) console.error('[fetchChinaOrders] items', e2);

  const byOrder = new Map<number, { positions: number; units: number; yuan: number; weight: number }>();
  for (const raw of (items ?? []) as ItemDb[]) {
    const acc = byOrder.get(raw.order_id) ?? { positions: 0, units: 0, yuan: 0, weight: 0 };
    acc.positions += 1;
    acc.units += num(raw.qty_ordered);
    acc.yuan += num(raw.sum_yuan);
    acc.weight += num(raw.total_weight_kg);
    byOrder.set(raw.order_id, acc);
  }

  return (orders ?? []).map((o) => {
    const agg = byOrder.get(o.id as number) ?? { positions: 0, units: 0, yuan: 0, weight: 0 };
    const rate = num(o.cny_rate);
    return {
      id: o.id as number,
      orderDate: o.order_date as string | null,
      supplier: o.supplier_name as string | null,
      status: o.status as string | null,
      cnyRate: rate,
      comment: o.comment as string | null,
      positions: agg.positions,
      units: agg.units,
      sumYuan: agg.yuan,
      sumRub: agg.yuan * rate,
      weightKg: agg.weight,
      usdRate: num(o.usd_rate_rub),
      servicesYuan: num(o.services_yuan),
      chinaDeliveryYuan: num(o.china_delivery_yuan),
      totalWeightKg: num(o.total_weight_kg),
      freightUsdPerKg: num(o.freight_usd_per_kg),
      freightRub: num(o.freight_rub),
      moscowDeliveryRub: num(o.moscow_delivery_rub),
    };
  });
}

/** Состав одного заказа. */
export async function fetchChinaOrderItems(orderId: number): Promise<ChinaOrderItemRow[]> {
  const supabase = createAdminClient();

  const { data: order } = await supabase.from('china_orders').select('cny_rate').eq('id', orderId).single();
  const rate = num(order?.cny_rate);

  const { data, error } = await supabase
    .from('china_order_items')
    .select(
      'id, comment, supplier_url, qty_ordered, qty_shipped, price_yuan, sum_yuan, delivery_yuan, unit_weight_kg, total_weight_kg, package_norm, box_size, sku_catalog(my_article, wb_article)',
    )
    .eq('order_id', orderId)
    .order('id');

  if (error) {
    console.error('[fetchChinaOrderItems]', error);
    return [];
  }

  type Joined = {
    id: number;
    comment: string | null;
    supplier_url: string | null;
    qty_ordered: number | null;
    qty_shipped: number | null;
    price_yuan: number | null;
    sum_yuan: number | null;
    delivery_yuan: number | null;
    unit_weight_kg: number | null;
    total_weight_kg: number | null;
    package_norm: number | null;
    box_size: string | null;
    sku_catalog: { my_article: string | null; wb_article: number | null } | null;
  };

  return ((data ?? []) as unknown as Joined[]).map((r) => ({
    id: r.id,
    myArticle: r.sku_catalog?.my_article ?? null,
    wbArticle: r.sku_catalog?.wb_article ?? null,
    name: r.comment,
    supplierUrl: r.supplier_url,
    qtyOrdered: num(r.qty_ordered),
    qtyShipped: num(r.qty_shipped),
    priceYuan: num(r.price_yuan),
    sumYuan: num(r.sum_yuan),
    sumRub: num(r.sum_yuan) * rate,
    deliveryYuan: num(r.delivery_yuan),
    unitWeightKg: num(r.unit_weight_kg),
    totalWeightKg: num(r.total_weight_kg),
    packageNorm: r.package_norm,
    boxSize: r.box_size,
  }));
}
