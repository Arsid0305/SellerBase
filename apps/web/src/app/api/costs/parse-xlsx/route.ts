import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParsedEntry = { barcode: string; cost_rub: number; valid_from: string; source: 'xlsx' };

function toIsoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd.mm.yyyy → yyyy-mm-dd
  const m = s.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\s+/g, '').replace(',', '.').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toBarcode(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'number') return String(Math.trunc(v));
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no file' }, { status: 400 });
  }
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    return NextResponse.json({ error: 'cannot parse xlsx' }, { status: 400 });
  }
  const ws = wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: 'no sheets' }, { status: 400 });

  const headerRow = ws.getRow(1);
  const colIdx: Record<string, number> = {};
  headerRow.eachCell((cell, idx) => {
    const key = String(cell.value ?? '').trim().toLowerCase();
    if (key) colIdx[key] = idx;
  });
  const bc = colIdx.barcode;
  const cost = colIdx.cost;
  const date = colIdx.valid_from;
  if (!bc || !cost || !date) {
    return NextResponse.json(
      { error: 'Ожидаемые колонки: barcode, cost, valid_from' },
      { status: 400 },
    );
  }

  const entries: ParsedEntry[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const barcode = toBarcode(row.getCell(bc).value);
    const cRub = toNumber(row.getCell(cost).value);
    const iso = toIsoDate(row.getCell(date).value);
    if (!barcode || cRub == null || cRub < 0 || !iso) continue;
    entries.push({ barcode, cost_rub: cRub, valid_from: iso, source: 'xlsx' });
  }

  return NextResponse.json({ entries });
}
