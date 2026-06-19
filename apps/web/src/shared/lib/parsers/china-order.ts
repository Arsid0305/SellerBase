import ExcelJS from 'exceljs';

export interface ChinaOrderItemRow {
  rowNum: number;
  supplier_url: string | null;
  comment: string | null;
  qty_ordered: number;
  price_yuan: number;
  delivery_yuan: number | null;
  my_article: string | null;
  wb_article: number | null;
}

export interface ParseChinaOrderResult {
  items: ChinaOrderItemRow[];
  warnings: string[];
}

type CellValue = ExcelJS.CellValue;

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

const HEADER_KEYWORDS = ['кол-во', 'цена, юань'];

/** Находит индекс строки заголовков — первую строку, где есть и "Кол-во" и "цена, юань". */
function findHeaderRow(ws: ExcelJS.Worksheet): number {
  const maxScan = Math.min(ws.rowCount, 10);
  for (let r = 1; r <= maxScan; r++) {
    const row = ws.getRow(r);
    let found = 0;
    row.eachCell((cell) => {
      const text = toText(cell.value)?.toLowerCase() ?? '';
      if (HEADER_KEYWORDS.some((kw) => text.includes(kw))) found++;
    });
    if (found >= 2) return r;
  }
  return 1;
}

export async function parseChinaOrderXlsx(
  buffer: Buffer | ArrayBuffer,
): Promise<ParseChinaOrderResult> {
  const warnings: string[] = [];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ExcelJS.Buffer);

  const ws = workbook.worksheets[0];
  if (!ws) {
    return { items: [], warnings: ['Файл не содержит листов'] };
  }

  const headerRowNum = findHeaderRow(ws);
  const firstDataRow = headerRowNum + 1;

  const items: ChinaOrderItemRow[] = [];

  for (let r = firstDataRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);

    const supplierUrl = toText(row.getCell(1).value);
    const comment = toText(row.getCell(3).value);
    const qtyCellRaw = row.getCell(4).value;
    const qtyCellText = typeof qtyCellRaw === 'string' ? qtyCellRaw.trim() : null;

    // Хвостовая сводная таблица ("Итого по таблице", "Доставка по Китаю", "ИТОГО" и т.п.)
    // помечена литералом "*" в колонке D (Кол-во) или служебным текстом в комментарии — на ней останавливаемся.
    if (qtyCellText === '*' || (comment && /^(итого|доставка по китаю|3% за услуги)/i.test(comment))) {
      break;
    }

    const qty = toNumber(qtyCellRaw);
    const price = toNumber(row.getCell(5).value);
    const delivery = toNumber(row.getCell(7).value);
    const myArticle = toText(row.getCell(8).value);
    const wbArticleRaw = row.getCell(9).value;
    const wbArticleNum = toNumber(wbArticleRaw);

    const isEmptyRow = qty == null && price == null && !supplierUrl && !comment;
    if (isEmptyRow) continue;

    if ((qty == null || price == null) && (myArticle || wbArticleNum != null)) {
      warnings.push(
        `Строка ${r}: есть артикул (Мой="${myArticle ?? ''}", ВБ="${wbArticleNum ?? ''}"), но нет кол-ва/цены — пропущено`,
      );
      continue;
    }

    if (qty == null || price == null) continue;

    items.push({
      rowNum: r,
      supplier_url: supplierUrl,
      comment,
      qty_ordered: qty,
      price_yuan: price,
      delivery_yuan: delivery,
      my_article: myArticle,
      wb_article: wbArticleNum,
    });
  }

  return { items, warnings };
}
