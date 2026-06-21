import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { parseUnitCogsXlsx } from '@/shared/lib/parsers/unit-cogs';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 });
  }

  const sheetNameRaw = form.get('sheet_name');
  const sheetName = sheetNameRaw ? String(sheetNameRaw).trim() || undefined : undefined;

  const sourceRaw = form.get('source');
  const source = sourceRaw ? String(sourceRaw).trim() || 'unit-excel' : 'unit-excel';

  const effectiveFromRaw = form.get('effective_from');
  const effectiveFrom = effectiveFromRaw ? String(effectiveFromRaw).trim() : '';
  const validFrom = effectiveFrom || todayIso();
  if (!isIsoDate(validFrom)) {
    return NextResponse.json({ error: 'invalid_effective_from' }, { status: 400 });
  }

  const buf = await file.arrayBuffer();

  let parsed: Awaited<ReturnType<typeof parseUnitCogsXlsx>>;
  try {
    parsed = await parseUnitCogsXlsx(buf, { sheetName });
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

  const wbArticles = [
    ...new Set(parsed.items.map((i) => i.wb_article).filter((v): v is number => v != null)),
  ];
  const myArticlesForFallback = [
    ...new Set(
      parsed.items
        .filter((i) => i.wb_article == null && i.my_article)
        .map((i) => i.my_article as string),
    ),
  ];

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

  const skuByMyArticle = new Map<string, number>();
  if (myArticlesForFallback.length > 0) {
    const { data: skuRows } = await supabase
      .from('sku_catalog')
      .select('id, my_article')
      .in('my_article', myArticlesForFallback);
    for (const r of (skuRows ?? []) as { id: number; my_article: string | null }[]) {
      if (r.my_article != null) skuByMyArticle.set(r.my_article, r.id);
    }
  }

  const warnings = [...parsed.warnings];
  let unmatchedCount = 0;

  type Matched = { skuId: number; cost_price_rub: number };
  const matched: Matched[] = [];

  for (const item of parsed.items) {
    let skuId: number | null = null;
    if (item.wb_article != null) {
      skuId = skuByWbArticle.get(item.wb_article) ?? null;
    }
    if (skuId == null && item.my_article) {
      skuId = skuByMyArticle.get(item.my_article) ?? null;
    }
    if (skuId == null) {
      unmatchedCount++;
      warnings.push(
        `SKU not found (строка ${item.rowNum}, Код WB="${item.wb_article ?? ''}", Арт.="${item.my_article ?? ''}", "${item.title ?? ''}")`,
      );
      continue;
    }
    matched.push({ skuId, cost_price_rub: item.cost_price_rub });
  }

  if (matched.length === 0) {
    return NextResponse.json(
      { error: 'no_matched_sku', warnings, unmatched_count: unmatchedCount },
      { status: 400 },
    );
  }

  const historyRows = matched.map((m) => ({
    sku_id: m.skuId,
    cost_rub: Math.round(m.cost_price_rub * 100) / 100,
    valid_from: validFrom,
    source,
  }));

  const { error: historyError, count: insertedHistoryCount } = await supabase
    .from('sku_cost_history')
    .insert(historyRows, { count: 'exact' });

  if (historyError) {
    return NextResponse.json(
      { error: 'history_insert_failed', details: historyError.message },
      { status: 500 },
    );
  }

  // sku_cost_history_close_prev триггер сам закрывает предыдущую открытую запись (valid_to)
  // при инсёрте новой — отдельный UPDATE не нужен.

  let updatedSkuCount = 0;
  await Promise.all(
    matched.map(async (m) => {
      const { error } = await supabase
        .from('sku_catalog')
        .update({ cost_price_rub: m.cost_price_rub })
        .eq('id', m.skuId);
      if (!error) updatedSkuCount++;
    }),
  );

  return NextResponse.json({
    updated_sku_count: updatedSkuCount,
    inserted_history_count: insertedHistoryCount ?? historyRows.length,
    warnings,
    unmatched_count: unmatchedCount,
  });
}
