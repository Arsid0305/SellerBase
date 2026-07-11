import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

type Item = {
  supplier_url?: string | null;
  comment?: string | null;
  qty_ordered: number;
  price_yuan: number;
  delivery_yuan?: number | null;
  my_article?: string | null;
  wb_article?: number | null;
  unit_weight_kg?: number | null;
  package_norm?: number | null;
  box_size?: string | null;
};

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const b = body as Partial<{
    order_date: string;
    supplier_name: string;
    cny_rate: number;
    comment: string;
    items: Item[];
  }>;

  const orderDate = (b.order_date ?? '').trim();
  if (!isIsoDate(orderDate)) return NextResponse.json({ error: 'invalid order_date' }, { status: 400 });

  const cnyRate = Number(b.cny_rate);
  if (!Number.isFinite(cnyRate) || cnyRate <= 0) return NextResponse.json({ error: 'invalid cny_rate' }, { status: 400 });

  const items = Array.isArray(b.items) ? b.items.filter((i): i is Item => i != null && Number.isFinite(Number(i.qty_ordered)) && Number(i.qty_ordered) > 0 && Number.isFinite(Number(i.price_yuan)) && Number(i.price_yuan) > 0) : [];
  if (items.length === 0) return NextResponse.json({ error: 'no items' }, { status: 400 });

  const supabase = createAdminClient();

  const { data: orderData, error: orderError } = await supabase
    .from('china_orders')
    .insert({
      order_date: orderDate,
      supplier_name: b.supplier_name?.trim() || null,
      cny_rate: cnyRate,
      comment: b.comment?.trim() || null,
    })
    .select('id')
    .single();
  if (orderError || !orderData) {
    return NextResponse.json({ error: 'order_insert_failed', details: orderError?.message }, { status: 500 });
  }
  const orderId = orderData.id as number;

  const wbArticles = [...new Set(items.map((i) => i.wb_article).filter((v): v is number => v != null && Number.isFinite(v)))];
  const skuByWbArticle = new Map<number, number>();
  if (wbArticles.length > 0) {
    const { data: skuRows } = await supabase.from('sku_catalog').select('id, wb_article').in('wb_article', wbArticles);
    for (const r of (skuRows ?? []) as { id: number; wb_article: number | null }[]) {
      if (r.wb_article != null) skuByWbArticle.set(r.wb_article, r.id);
    }
  }

  const warnings: string[] = [];
  let unmatchedSkuCount = 0;
  const rowsToInsert = items.map((item) => {
    let skuId: number | null = null;
    if (item.wb_article != null) {
      skuId = skuByWbArticle.get(item.wb_article) ?? null;
      if (skuId == null) {
        unmatchedSkuCount++;
        warnings.push(`WB article ${item.wb_article} not found in sku_catalog`);
      }
    }
    return {
      order_id: orderId,
      sku_id: skuId,
      supplier_url: item.supplier_url ?? null,
      comment: item.comment ?? null,
      qty_ordered: Number(item.qty_ordered),
      price_yuan: Number(item.price_yuan),
      delivery_yuan: item.delivery_yuan ?? null,
      unit_weight_kg: item.unit_weight_kg ?? null,
      package_norm: item.package_norm ?? null,
      box_size: item.box_size ?? null,
    };
  });
  const { error: itemsError } = await supabase.from('china_order_items').insert(rowsToInsert);
  if (itemsError) {
    return NextResponse.json({ error: 'items_insert_failed', details: itemsError.message, order_id: orderId }, { status: 500 });
  }

  // FIFO: заполняем sku_cost_history для позиций с известным sku_id.
  let costHistoryInserted = 0;
  const bySku = new Map<number, { cost: number; qty: number }>();
  for (const item of items) {
    if (item.wb_article == null) continue;
    const skuId = skuByWbArticle.get(item.wb_article);
    if (skuId == null) continue;
    const qty = Number(item.qty_ordered);
    const deliveryPerUnit = item.delivery_yuan != null && qty > 0 ? Number(item.delivery_yuan) / qty : 0;
    const costPerUnit = (Number(item.price_yuan) + deliveryPerUnit) * cnyRate;
    if (!Number.isFinite(costPerUnit) || costPerUnit <= 0) continue;
    const prev = bySku.get(skuId);
    if (prev) {
      const tot = prev.qty + qty;
      bySku.set(skuId, { cost: (prev.cost * prev.qty + costPerUnit * qty) / tot, qty: tot });
    } else {
      bySku.set(skuId, { cost: costPerUnit, qty });
    }
  }
  if (bySku.size > 0) {
    const skuIds = [...bySku.keys()];
    await supabase
      .from('sku_cost_history')
      .update({ valid_to: orderDate })
      .in('sku_id', skuIds)
      .is('valid_to', null)
      .lt('valid_from', orderDate);

    const historyRows = [...bySku.entries()].map(([sku_id, v]) => ({
      sku_id,
      cost_rub: Math.round(v.cost * 100) / 100,
      valid_from: orderDate,
      source: `china_order:${orderId}`,
    }));
    const { error: histError } = await supabase.from('sku_cost_history').insert(historyRows);
    if (histError) warnings.push(`sku_cost_history: ${histError.message}`);
    else costHistoryInserted = historyRows.length;
  }

  return NextResponse.json({
    order_id: orderId,
    inserted_count: rowsToInsert.length,
    cost_history_inserted: costHistoryInserted,
    unmatched_sku_count: unmatchedSkuCount,
    warnings,
  });
}
