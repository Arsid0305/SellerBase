import { NextResponse } from 'next/server';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { fetchPromoDetail } from '@/entities/promo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Шаблон WB-кабинета «Установка цен на товар», лист `prices`, 14 колонок:
// A Бренд | B Категория | C Артикул WB | D Артикул продавца | E Последний баркод
// F Остатки WB | G Остатки продавца | H Оборачиваемость
// I Текущая цена | J Новая цена | K Текущая скидка | L Новая скидка
// M Цена со скидкой (формула шаблона) | N Наличие ошибки (формула шаблона)
//
// Заполняем только колонки A-L. M и N остаются формулами из шаблона.
// Для строк где «Участвую» = true пишем новую цену/скидку из plan_price/plan_discount;
// для остальных оставляем J и L пустыми (тогда WB-валидация считает строку без изменений).

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const promotionId = Number(id);
  if (!Number.isFinite(promotionId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 });
  }

  const { promo, rows } = await fetchPromoDetail(promotionId);
  if (!promo) {
    return NextResponse.json({ error: 'promo not found' }, { status: 404 });
  }

  const templatePath = path.join(process.cwd(), 'templates/wb_promo_prices.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const sheet = workbook.getWorksheet('prices');
  if (!sheet) {
    return NextResponse.json({ error: 'template missing `prices` sheet' }, { status: 500 });
  }

  // Сохраняем заголовок (строка 1) и формулы шаблона из строки 2 (M2, N2).
  const formulaM = sheet.getRow(2).getCell(13).value;
  const formulaN = sheet.getRow(2).getCell(14).value;

  // Удаляем все строки данных шаблона, оставляя заголовок.
  if (sheet.rowCount > 1) {
    sheet.spliceRows(2, sheet.rowCount - 1);
  }

  rows.forEach((r, idx) => {
    const excelRow = idx + 2;
    const participates = r.userParticipate === true;
    const row = sheet.getRow(excelRow);

    row.getCell(1).value = r.brand ?? '';
    row.getCell(2).value = r.subjectName ?? '';
    row.getCell(3).value = r.nmId;
    row.getCell(4).value = r.myArticle ?? '';
    row.getCell(5).value = r.barcode ?? '';
    row.getCell(6).value = r.stockUnits;
    row.getCell(7).value = '';
    row.getCell(8).value = r.turnoverDays ?? '';
    row.getCell(9).value = r.currentPrice ?? '';
    row.getCell(10).value = participates && r.planPrice != null ? r.planPrice : '';
    row.getCell(11).value = r.currentDiscount ?? '';
    row.getCell(12).value = participates && r.planDiscount != null ? r.planDiscount : '';

    // Колонки M/N — формулы шаблона, ссылаются на текущий ряд через подстановку индекса.
    const rewrite = (val: ExcelJS.CellValue): ExcelJS.CellValue => {
      if (val && typeof val === 'object' && 'formula' in val && typeof val.formula === 'string') {
        const formula = val.formula.replace(/(\$?[A-Z]+\$?)2\b/g, `$1${excelRow}`);
        return { ...val, formula };
      }
      return val;
    };
    row.getCell(13).value = rewrite(formulaM);
    row.getCell(14).value = rewrite(formulaN);

    row.commit();
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = promo.name.replace(/[^\w\-А-Яа-яЁё ]+/g, '').slice(0, 40).trim() || `promo_${promotionId}`;
  return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
