import { NextResponse } from 'next/server';
import { fetchSupplyPlan, fetchPlanItems } from '@/entities/supplies';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// TODO(supplies): заменить CSV на полноценный XLSX через exceljs (пакет не подключён в apps/web).
// Сейчас отдаём CSV (разделитель `;`, UTF-8 BOM) — Excel открывает корректно в RU-локали.

function escapeCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const planId = Number(id);
  if (!Number.isFinite(planId)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const plan = await fetchSupplyPlan(planId);
  if (!plan) return NextResponse.json({ error: 'plan_not_found' }, { status: 404 });

  const items = await fetchPlanItems(planId);
  if (items.length === 0) {
    return NextResponse.json({ error: 'empty_plan' }, { status: 400 });
  }

  // Подтягиваем SKU для штрихкода и названия
  const skuIds = [...new Set(items.map((i) => i.skuId))];
  const supabase = createAdminClient();
  const { data: skuRows } = await supabase
    .from('sku_catalog')
    .select('id, barcode, title')
    .in('id', skuIds);
  const byId = new Map<number, { barcode: string | null; title: string | null }>();
  for (const r of (skuRows ?? []) as { id: number; barcode: string | null; title: string | null }[]) {
    byId.set(r.id, { barcode: r.barcode, title: r.title });
  }

  // Группируем по штрихкоду — складываем количество (в ФФ-шаблон везут общий объём)
  const byBarcode = new Map<string, { qty: number; title: string }>();
  for (const it of items) {
    const sku = byId.get(it.skuId);
    if (!sku) continue;
    const bc = sku.barcode ?? `sku-${it.skuId}`;
    const cur = byBarcode.get(bc) ?? { qty: 0, title: sku.title ?? '' };
    cur.qty += it.qty;
    byBarcode.set(bc, cur);
  }

  const header = ['Штрихкод', 'Количество', 'Название'];
  const lines: string[] = [header.map(escapeCell).join(';')];
  for (const [bc, v] of byBarcode) {
    lines.push([bc, v.qty, v.title].map(escapeCell).join(';'));
  }
  const csv = '﻿' + lines.join('\r\n');

  const fname = `ff-${plan.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}-${planId}.csv`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  });
}
