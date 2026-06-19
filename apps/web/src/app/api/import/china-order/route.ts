import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { parseChinaOrderXlsx } from '@/shared/lib/parsers/china-order';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 });
  }

  const orderDate = String(form.get('order_date') ?? '').trim();
  if (!orderDate || !isIsoDate(orderDate)) {
    return NextResponse.json({ error: 'order_date_required' }, { status: 400 });
  }

  const cnyRateRaw = form.get('cny_rate');
  const cnyRate = cnyRateRaw != null && String(cnyRateRaw).trim() !== '' ? Number(cnyRateRaw) : null;
  if (cnyRate != null && !Number.isFinite(cnyRate)) {
    return NextResponse.json({ error: 'invalid_cny_rate' }, { status: 400 });
  }

  const supplierName = form.get('supplier_name');
  const comment = form.get('comment');

  const buf = await file.arrayBuffer();

  let parsed: Awaited<ReturnType<typeof parseChinaOrderXlsx>>;
  try {
    parsed = await parseChinaOrderXlsx(buf);
  } catch {
    return NextResponse.json({ error: 'cannot_parse_xlsx' }, { status: 400 });
  }

  if (parsed.items.length === 0) {
    return NextResponse.json(
      { error: 'no_valid_rows', warnings: parsed.warnings },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: orderData, error: orderError } = await supabase
    .from('china_orders')
    .insert({
      order_date: orderDate,
      supplier_name: supplierName ? String(supplierName).trim() || null : null,
      cny_rate: cnyRate,
      comment: comment ? String(comment).trim() || null : null,
    })
    .select('id')
    .single();

  if (orderError || !orderData) {
    return NextResponse.json({ error: 'order_insert_failed', details: orderError?.message }, { status: 500 });
  }

  const orderId = orderData.id as number;

  const wbArticles = [...new Set(parsed.items.map((i) => i.wb_article).filter((v): v is number => v != null))];

  const skuByWbArticle = new Map<number, number>();
  if (wbArticles.length > 0) {
    const { data: skuRows } = await supabase
      .from('sku_catalog')
      .select('id, wb_article')
      .in('wb_article', wbArticles);
    for (const r of (skuRows ?? []) as { id: number; wb_article: number | null }[]) {
      if (r.wb_article != null) skuByWbArticle.set(r.wb_article, r.id);
    }
  }

  const warnings = [...parsed.warnings];
  let unmatchedSkuCount = 0;

  const rowsToInsert = parsed.items.map((item) => {
    let skuId: number | null = null;
    if (item.wb_article != null) {
      skuId = skuByWbArticle.get(item.wb_article) ?? null;
      if (skuId == null) {
        unmatchedSkuCount++;
        warnings.push(`WB article ${item.wb_article} not found in sku_catalog (строка ${item.rowNum})`);
      }
    }
    return {
      order_id: orderId,
      sku_id: skuId,
      supplier_url: item.supplier_url,
      comment: item.comment,
      qty_ordered: item.qty_ordered,
      price_yuan: item.price_yuan,
      delivery_yuan: item.delivery_yuan,
    };
  });

  const { error: itemsError, count } = await supabase
    .from('china_order_items')
    .insert(rowsToInsert, { count: 'exact' });

  if (itemsError) {
    return NextResponse.json(
      { error: 'items_insert_failed', details: itemsError.message, order_id: orderId },
      { status: 500 },
    );
  }

  return NextResponse.json({
    order_id: orderId,
    inserted_count: count ?? rowsToInsert.length,
    warnings,
    unmatched_sku_count: unmatchedSkuCount,
  });
}
