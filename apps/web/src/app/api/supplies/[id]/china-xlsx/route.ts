import { NextResponse } from 'next/server';
import { fetchSupplyPlan, fetchPlanChinaItems } from '@/entities/supplies';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// TODO(supplies): заменить CSV на XLSX через уже подключённый exceljs.
// Поля заказа на 1688: ссылка, фото, комментарий, кол-во, цена юань, сумма юань, доставка.

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

  const items = await fetchPlanChinaItems(planId);
  if (items.length === 0) {
    return NextResponse.json({ error: 'empty_china_plan' }, { status: 400 });
  }

  const supplierIds = [...new Set(items.map((i) => i.supplierId).filter((v): v is number => v != null))];
  const skuIds = [...new Set(items.map((i) => i.skuId))];

  const supabase = createAdminClient();
  const [supRes, skuRes] = await Promise.all([
    supplierIds.length > 0
      ? supabase
          .from('sku_china_suppliers')
          .select('id, supplier_name, link_1688, price_cny')
          .in('id', supplierIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('sku_catalog').select('id, title, my_article').in('id', skuIds),
  ]);

  const supById = new Map<number, { name: string; link: string; price: number | null }>();
  for (const r of ((supRes.data ?? []) as { id: number; supplier_name: string; link_1688: string; price_cny: number | null }[])) {
    supById.set(r.id, { name: r.supplier_name, link: r.link_1688, price: r.price_cny != null ? Number(r.price_cny) : null });
  }
  const skuById = new Map<number, { title: string | null; myArticle: string | null }>();
  for (const r of ((skuRes.data ?? []) as { id: number; title: string | null; my_article: string | null }[])) {
    skuById.set(r.id, { title: r.title, myArticle: r.my_article });
  }

  const header = ['Ссылка 1688', 'Фото', 'Комментарий', 'Количество', 'Цена, юань', 'Сумма, юань', 'Доставка'];
  const lines: string[] = [header.map(escapeCell).join(';')];
  for (const it of items) {
    const sup = it.supplierId != null ? supById.get(it.supplierId) : null;
    const sku = skuById.get(it.skuId);
    const price = it.priceCny ?? sup?.price ?? null;
    const sum = price != null ? Number((price * it.qty).toFixed(2)) : '';
    const comment = [sku?.myArticle, sku?.title].filter(Boolean).join(' — ');
    lines.push(
      [
        sup?.link ?? '',
        '', // фото — пустое, ставим из ссылки вручную
        comment,
        it.qty,
        price ?? '',
        sum,
        '', // доставка вручную
      ]
        .map(escapeCell)
        .join(';'),
    );
  }
  const csv = '﻿' + lines.join('\r\n');

  const fname = `china-${plan.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}-${planId}.csv`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  });
}
