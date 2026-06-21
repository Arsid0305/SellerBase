import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const dynamic = 'force-dynamic';

type Entry = {
  sku_id?: number;
  barcode?: string;
  cost_rub: number;
  valid_from: string;
  source?: string;
};

function isValidDate(s: string): boolean {
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

  const raw = body as { entries?: Entry[] } & Entry;
  const entries: Entry[] = Array.isArray(raw.entries) ? raw.entries : [raw];

  if (entries.length === 0) {
    return NextResponse.json({ error: 'no entries' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const needBarcodeLookup = entries.some((e) => !e.sku_id && e.barcode);
  let barcodeToId = new Map<string, number>();
  if (needBarcodeLookup) {
    const barcodes = [...new Set(entries.map((e) => e.barcode).filter((b): b is string => !!b))];
    const { data, error } = await supabase
      .from('sku_catalog')
      .select('id, barcode')
      .in('barcode', barcodes);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    barcodeToId = new Map(
      ((data ?? []) as { id: number; barcode: string }[]).map((r) => [String(r.barcode), Number(r.id)]),
    );
  }

  const rows: { sku_id: number; cost_rub: number; valid_from: string; source: string }[] = [];
  const skipped: { entry: Entry; reason: string }[] = [];

  for (const e of entries) {
    let skuId = e.sku_id;
    if (!skuId && e.barcode) {
      skuId = barcodeToId.get(String(e.barcode));
    }
    if (!skuId) {
      skipped.push({ entry: e, reason: 'sku not found' });
      continue;
    }
    if (typeof e.cost_rub !== 'number' || !Number.isFinite(e.cost_rub) || e.cost_rub < 0) {
      skipped.push({ entry: e, reason: 'invalid cost_rub' });
      continue;
    }
    if (!e.valid_from || !isValidDate(e.valid_from)) {
      skipped.push({ entry: e, reason: 'invalid valid_from' });
      continue;
    }
    rows.push({
      sku_id: Number(skuId),
      cost_rub: Math.round(e.cost_rub * 100) / 100,
      valid_from: e.valid_from,
      source: e.source || 'manual',
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, skipped }, { status: 400 });
  }

  const { error: insertError } = await supabase.from('sku_cost_history').insert(rows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const skuIds = [...new Set(rows.map((r) => r.sku_id))];
  const latestBySku = new Map<number, { cost: number; date: string }>();
  for (const r of rows) {
    const cur = latestBySku.get(r.sku_id);
    if (!cur || r.valid_from > cur.date) latestBySku.set(r.sku_id, { cost: r.cost_rub, date: r.valid_from });
  }
  await Promise.all(
    skuIds.map((id) => {
      const v = latestBySku.get(id);
      if (!v) return Promise.resolve();
      return supabase.from('sku_catalog').update({ cost_price_rub: v.cost }).eq('id', id);
    }),
  );

  return NextResponse.json({ inserted: rows.length, skipped });
}
