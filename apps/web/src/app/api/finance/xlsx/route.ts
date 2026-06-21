import { NextResponse } from 'next/server';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = createAdminClient();
  const url = new URL(req.url);
  const yearParam = Number(url.searchParams.get('year'));
  const year = Number.isFinite(yearParam) && yearParam >= 2020 && yearParam <= 2099
    ? yearParam
    : new Date().getUTCFullYear();

  // Заменено: .range(0, 200_000) на wb_reports_fact — теперь недельный агрегат в БД через RPC.
  const { data: weekly } = await supabase.rpc('get_xlsx_weekly_units', { p_year: year });

  const wbByWeek = new Map<number, number>();
  for (const r of (weekly ?? []) as { week: number | null; qty: number | string | null }[]) {
    if (r.week == null || r.qty == null) continue;
    const q = typeof r.qty === 'number' ? r.qty : Number(r.qty);
    if (!Number.isFinite(q)) continue;
    wbByWeek.set(r.week, (wbByWeek.get(r.week) ?? 0) + q);
  }

  const templatePath = path.join(process.cwd(), 'templates/cf_pl_2026.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const wbSheet = workbook.getWorksheet('PL WB (нед)');
  if (wbSheet) {
    for (let week = 1; week <= 53; week++) {
      const col = 2 + week;
      wbSheet.getRow(7).getCell(col).value = wbByWeek.get(week) ?? 0;
    }
  }

  const ozSheet = workbook.getWorksheet('PL OZON (нед)');
  if (ozSheet) {
    for (let week = 1; week <= 53; week++) {
      const col = 2 + week;
      ozSheet.getRow(7).getCell(col).value = 0;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="CF_PL_${year}.xlsx"`,
    },
  });
}
