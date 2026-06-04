import path from 'node:path';
import ExcelJS from 'exceljs';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const YEAR = 2026;
const WEEKS = 53;
const START_COL = 3; // C
const ROW_SALES_UNITS = 7;

/**
 * Возвращает массив [start, end] ISO-дат для каждой "недели" по схеме шаблона:
 * - неделя 1: 01.01–04.01
 * - дальше: 7-дневные блоки с 05.01
 */
function buildWeekRanges(year: number, weeks: number): Array<{ from: string; to: string }> {
  const ranges: Array<{ from: string; to: string }> = [];
  const pad = (n: number) => String(n).padStart(2, '0');
  const toIso = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  ranges.push({ from: `${year}-01-01`, to: `${year}-01-04` });
  const start = new Date(Date.UTC(year, 0, 5));
  for (let i = 1; i < weeks; i++) {
    const from = new Date(start.getTime());
    from.setUTCDate(start.getUTCDate() + (i - 1) * 7);
    const to = new Date(from.getTime());
    to.setUTCDate(from.getUTCDate() + 6);
    ranges.push({ from: toIso(from), to: toIso(to) });
  }
  return ranges;
}

async function fetchWbWeeklyUnits(): Promise<number[]> {
  const supabase = createAdminClient();
  const ranges = buildWeekRanges(YEAR, WEEKS);
  const yearFrom = `${YEAR}-01-01`;
  const yearTo = `${YEAR + 1}-01-01`;
  const result = new Array<number>(WEEKS).fill(0);

  const pageSize = 1000;
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('wb_reports_fact')
      .select('rr_dt, quantity, nm_id')
      .gte('rr_dt', yearFrom)
      .lt('rr_dt', yearTo)
      .gt('quantity', 0)
      .not('nm_id', 'is', null)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`[xlsx] wb_reports_fact: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      const dt = String(row.rr_dt);
      const qty = Number(row.quantity ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      for (let i = 0; i < WEEKS; i++) {
        const r = ranges[i]!;
        if (dt >= r.from && dt <= r.to) {
          result[i] = (result[i] ?? 0) + qty;
          break;
        }
      }
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return result;
}

function templatePath(): string {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'apps/web/templates/cf_pl_2026.xlsx'),
    path.join(cwd, 'templates/cf_pl_2026.xlsx'),
  ];
  return candidates[0]!;
}

export async function GET() {
  try {
    const wbUnits = await fetchWbWeeklyUnits();
    const ozUnits = new Array<number>(WEEKS).fill(0); // Этап A: OZON источника нет — нули

    const workbook = new ExcelJS.Workbook();
    const file = templatePath();
    await workbook.xlsx.readFile(file).catch(async () => {
      // fallback на случай иного cwd
      await workbook.xlsx.readFile(path.join(process.cwd(), 'templates/cf_pl_2026.xlsx'));
    });

    const fillSheet = (sheetName: string, values: number[]) => {
      const ws = workbook.getWorksheet(sheetName);
      if (!ws) return;
      for (let i = 0; i < WEEKS; i++) {
        const cell = ws.getCell(ROW_SALES_UNITS, START_COL + i);
        cell.value = values[i] ?? 0;
      }
    };

    fillSheet('PL WB (нед)', wbUnits);
    fillSheet('PL OZON (нед)', ozUnits);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="CF_PL_2026.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
