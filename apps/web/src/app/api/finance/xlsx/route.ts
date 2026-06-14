import { NextResponse } from 'next/server';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();
  const year = 2026;

  const { data: facts } = await supabase
    .from('wb_reports_fact')
    .select('rr_dt, quantity')
    .gte('rr_dt', `${year}-01-01`)
    .lte('rr_dt', `${year}-12-31`)
    .gt('quantity', 0)
    .range(0, 200_000);

  const wbByWeek = new Map<number, number>();
  for (const f of facts ?? []) {
    if (!f.rr_dt || !f.quantity) continue;
    const d = new Date(`${f.rr_dt}T00:00:00Z`);
    const target = new Date(d);
    target.setUTCDate(d.getUTCDate() + 3 - (d.getUTCDay() || 7));
    const week1 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const week =
      1 +
      Math.round(
        ((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() || 7) - 1)) / 7,
      );
    wbByWeek.set(week, (wbByWeek.get(week) ?? 0) + f.quantity);
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
