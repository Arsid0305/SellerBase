import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { requireAuth } from '@/shared/lib/auth/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const planId = Number(id);
  if (!Number.isFinite(planId) || planId <= 0) {
    return NextResponse.json({ error: 'invalid plan id' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const [{ data: plan }, { data: itemsRaw }] = await Promise.all([
    supabase.from('supply_plans').select('id, name, status, notes, created_at').eq('id', planId).single(),
    supabase
      .from('supply_plan_items')
      .select('sku_id, warehouse_name, qty, sku_catalog(my_article, wb_article, barcode, title, subject_name)')
      .eq('plan_id', planId),
  ]);
  if (!plan) return NextResponse.json({ error: 'plan not found' }, { status: 404 });

  type JoinedRaw = {
    sku_id: number; warehouse_name: string | null; qty: number;
    sku_catalog: { my_article: string | null; wb_article: number | null; barcode: string | null; title: string | null; subject_name: string | null } | { my_article: string | null; wb_article: number | null; barcode: string | null; title: string | null; subject_name: string | null }[] | null;
  };
  type Joined = { sku_id: number; warehouse_name: string | null; qty: number; sku_catalog: { my_article: string | null; wb_article: number | null; barcode: string | null; title: string | null; subject_name: string | null } | null };
  const items: Joined[] = ((itemsRaw ?? []) as JoinedRaw[]).map((r) => ({
    sku_id: r.sku_id,
    warehouse_name: r.warehouse_name,
    qty: r.qty,
    sku_catalog: Array.isArray(r.sku_catalog) ? (r.sku_catalog[0] ?? null) : r.sku_catalog,
  }));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SellerBase';
  wb.created = new Date();
  const ws = wb.addWorksheet('ТЗ-ФФ');

  ws.columns = [
    { header: '№', key: 'n', width: 5 },
    { header: 'Артикул', key: 'my_article', width: 18 },
    { header: 'Артикул WB', key: 'wb_article', width: 14 },
    { header: 'Штрих-код', key: 'barcode', width: 18 },
    { header: 'Название', key: 'title', width: 46 },
    { header: 'Категория', key: 'subject', width: 18 },
    { header: 'Склад назначения WB', key: 'warehouse', width: 24 },
    { header: 'Количество', key: 'qty', width: 12 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.getRow(1).height = 28;
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

  items.forEach((it, i) => {
    ws.addRow({
      n: i + 1,
      my_article: it.sku_catalog?.my_article ?? '',
      wb_article: it.sku_catalog?.wb_article ?? '',
      barcode: it.sku_catalog?.barcode ?? '',
      title: it.sku_catalog?.title ?? '',
      subject: it.sku_catalog?.subject_name ?? '',
      warehouse: it.warehouse_name ?? '—',
      qty: it.qty,
    });
  });

  const totalQty = items.reduce((s, it) => s + (it.qty ?? 0), 0);
  const totalRow = ws.addRow({ title: 'ИТОГО:', qty: totalQty });
  totalRow.font = { bold: true };
  totalRow.getCell('title').alignment = { horizontal: 'right' };

  ws.getColumn('qty').alignment = { horizontal: 'right' };
  ws.getColumn('n').alignment = { horizontal: 'center' };

  // Header block above data
  ws.insertRow(1, []);
  ws.insertRow(1, [`Дата: ${new Date().toLocaleDateString('ru-RU')}`]);
  ws.insertRow(1, [`Статус: ${plan.status}`]);
  ws.insertRow(1, [`ТЗ-ФФ: ${plan.name}`]);
  ws.getRow(1).font = { bold: true, size: 14 };

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `TZ-FF-plan-${planId}-${plan.name.replace(/[^\w-]+/g, '_').slice(0, 40)}.xlsx`;
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
