import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

type MonthlyPnl = {
  revenue: number;
  commission: number;
  logistics: number;
  cogs: number;
  tax: number;
  netProfit: number;
  unitsSold: number;
};

function emptyMonthlyPnl(): MonthlyPnl {
  return { revenue: 0, commission: 0, logistics: 0, cogs: 0, tax: 0, netProfit: 0, unitsSold: 0 };
}

function toNumber(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function lastDayOfMonth(year: number, monthIndex: number): string {
  // monthIndex: 0-11. Day 0 of next month = last day of this month.
  const d = new Date(Date.UTC(year, monthIndex + 1, 0));
  return d.toISOString().slice(0, 10);
}

async function fetchMonthlyPnl(
  supabase: ReturnType<typeof createAdminClient>,
  year: number,
  monthIndex: number,
): Promise<MonthlyPnl> {
  const from = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const to = lastDayOfMonth(year, monthIndex);

  const { data, error } = await supabase.rpc('get_pnl_by_period', {
    p_from: from,
    p_to: to,
  });
  if (error) {
    console.error('[pl-wb-xlsx] get_pnl_by_period error', error);
    return emptyMonthlyPnl();
  }

  type Row = {
    revenue_rub: number | null;
    commission_rub: number | null;
    logistics_rub: number | null;
    cogs_rub: number | null;
    tax_rub: number | null;
    net_profit_rub: number | null;
    units_sold: number | null;
  };
  const rows = (data ?? []) as Row[];

  return rows.reduce<MonthlyPnl>((acc, r) => {
    acc.revenue += toNumber(r.revenue_rub);
    acc.commission += toNumber(r.commission_rub);
    acc.logistics += toNumber(r.logistics_rub);
    acc.cogs += toNumber(r.cogs_rub);
    acc.tax += toNumber(r.tax_rub);
    acc.netProfit += toNumber(r.net_profit_rub);
    acc.unitsSold += toNumber(r.units_sold);
    return acc;
  }, emptyMonthlyPnl());
}

export async function GET(req: Request) {
  const supabase = createAdminClient();
  const url = new URL(req.url);
  const yearParam = Number(url.searchParams.get('year'));
  const year = Number.isFinite(yearParam) && yearParam >= 2020 && yearParam <= 2099
    ? yearParam
    : new Date().getUTCFullYear();

  const months = await Promise.all(
    Array.from({ length: 12 }, (_, monthIndex) => fetchMonthlyPnl(supabase, year, monthIndex)),
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('PL WB');

  sheet.getColumn(1).width = 32;
  for (let col = 2; col <= 13; col++) {
    sheet.getColumn(col).width = 13;
  }
  sheet.getColumn(14).width = 14;

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2EFD9' },
  };

  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = 'Прибыли и убытки';
  titleRow.getCell(1).font = { bold: true };
  titleRow.getCell(1).fill = headerFill;
  sheet.mergeCells(1, 2, 1, 14);
  titleRow.getCell(2).value = year;
  titleRow.getCell(2).font = { bold: true };
  for (let col = 1; col <= 14; col++) {
    titleRow.getCell(col).fill = headerFill;
  }

  const headerRow = sheet.getRow(2);
  headerRow.getCell(1).value = 'Статья';
  for (let i = 0; i < 12; i++) {
    headerRow.getCell(2 + i).value = MONTH_NAMES[i];
  }
  headerRow.getCell(14).value = 'Итого за год';
  headerRow.font = { bold: true };

  type RowDef = {
    label: string;
    pick: (m: MonthlyPnl) => number;
    isPercent?: boolean;
  };

  const rowDefs: RowDef[] = [
    { label: 'Выручка', pick: (m) => m.revenue },
    { label: 'Комиссия', pick: (m) => m.commission },
    { label: 'Логистика', pick: (m) => m.logistics },
    { label: 'Хранение', pick: () => 0 },
    { label: 'Эквайринг', pick: () => 0 },
    { label: 'Себестоимость', pick: (m) => m.cogs },
    { label: 'Налог', pick: (m) => m.tax },
    { label: 'Прибыль', pick: (m) => m.netProfit },
    {
      label: 'Маржа %',
      pick: (m) => (m.revenue > 0 ? (m.netProfit / m.revenue) * 100 : 0),
      isPercent: true,
    },
  ];

  let currentRowIndex = 3;
  for (const def of rowDefs) {
    const row = sheet.getRow(currentRowIndex);
    row.getCell(1).value = def.label;

    let yearTotal = 0;
    let yearRevenue = 0;
    for (let i = 0; i < 12; i++) {
      const month = months[i] ?? emptyMonthlyPnl();
      const value = def.pick(month);
      const cell = row.getCell(2 + i);
      cell.value = Math.round(value * 100) / 100;
      if (def.isPercent) {
        yearTotal += month.netProfit;
        yearRevenue += month.revenue;
      } else {
        yearTotal += value;
      }
    }

    const totalCell = row.getCell(14);
    if (def.isPercent) {
      totalCell.value = yearRevenue > 0 ? Math.round((yearTotal / yearRevenue) * 100 * 100) / 100 : 0;
    } else {
      totalCell.value = Math.round(yearTotal * 100) / 100;
    }
    totalCell.font = { bold: true };

    currentRowIndex += 1;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="PL_WB_${year}.xlsx"`,
    },
  });
}
