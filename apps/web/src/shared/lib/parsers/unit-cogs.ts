import ExcelJS from 'exceljs';

export interface UnitCogsRow {
  rowNum: number;
  wb_article: number | null;
  my_article: string | null;
  barcode: string | null;
  cost_price_rub: number;
  title: string | null;
}

export interface ParseUnitCogsResult {
  items: UnitCogsRow[];
  warnings: string[];
}

type CellValue = ExcelJS.CellValue;

const DEFAULT_SHEET_NAME = 'Себес';

/** Разворачивает значение ячейки ExcelJS (hyperlink/richText/formula result) в примитив. */
function unwrapCell(value: CellValue): string | number | null {
  if (value == null) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value) {
      return unwrapCell((value as { result: CellValue }).result);
    }
    if ('text' in value) {
      return (value as { text: string }).text;
    }
    if ('richText' in value) {
      return (value as { richText: { text: string }[] }).richText.map((p) => p.text).join('');
    }
    if ('sharedFormula' in value || 'formula' in value) {
      // Формула без вычисленного результата — нет значения, которое можно использовать.
      return null;
    }
  }
  return null;
}

function toText(value: CellValue): string | null {
  const v = unwrapCell(value);
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function toNumber(value: CellValue): number | null {
  const v = unwrapCell(value);
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\s+/g, '').replace(',', '.').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Находит индекс строки заголовков — первую строку, где в колонке A текст содержит "код wb". */
function findHeaderRow(ws: ExcelJS.Worksheet): number {
  const maxScan = Math.min(ws.rowCount, 10);
  for (let r = 1; r <= maxScan; r++) {
    const text = toText(ws.getRow(r).getCell(1).value)?.toLowerCase() ?? '';
    if (text.includes('код wb')) return r;
  }
  return 1;
}

export async function parseUnitCogsXlsx(
  buffer: Buffer | ArrayBuffer,
  options?: { sheetName?: string },
): Promise<ParseUnitCogsResult> {
  const sheetName = options?.sheetName?.trim() || DEFAULT_SHEET_NAME;
  const warnings: string[] = [];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ExcelJS.Buffer);

  const ws = workbook.getWorksheet(sheetName);
  if (!ws) {
    return { items: [], warnings: [`Лист "${sheetName}" не найден в файле`] };
  }

  const headerRowNum = findHeaderRow(ws);
  const firstDataRow = headerRowNum + 1;

  const items: UnitCogsRow[] = [];

  for (let r = firstDataRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    const wbArticleRaw = row.getCell(1).value;
    const myArticle = toText(row.getCell(3).value);
    const title = toText(row.getCell(4).value);
    const barcodeRaw = row.getCell(5).value;
    const costRaw = row.getCell(6).value;

    const wbArticleText = toText(wbArticleRaw);
    const wbArticleNum = toNumber(wbArticleRaw);
    const barcode = toText(barcodeRaw);
    const cost = toNumber(costRaw);

    const isEmptyRow = !wbArticleText && !myArticle && !barcode && cost == null;
    if (isEmptyRow) continue;

    if (!wbArticleText && !myArticle) {
      continue;
    }

    if (wbArticleText && wbArticleNum == null) {
      warnings.push(`Строка ${r}: Код WB "${wbArticleText}" не число — пропущено`);
      continue;
    }

    if (cost == null || cost === 0) {
      warnings.push(
        `Строка ${r}: пустая или нулевая себестоимость (Арт. "${myArticle ?? wbArticleNum ?? ''}") — пропущено`,
      );
      continue;
    }

    items.push({
      rowNum: r,
      wb_article: wbArticleNum,
      my_article: myArticle,
      barcode,
      cost_price_rub: cost,
      title,
    });
  }

  return { items, warnings };
}
