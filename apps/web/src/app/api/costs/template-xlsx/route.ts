import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SellerBase';
  wb.created = new Date();

  const ws = wb.addWorksheet('Себестоимость');
  ws.columns = [
    { header: 'barcode', key: 'barcode', width: 22 },
    { header: 'cost', key: 'cost', width: 14, style: { numFmt: '#,##0.00' } },
    { header: 'valid_from', key: 'valid_from', width: 14, style: { numFmt: 'yyyy-mm-dd' } },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F0F0' },
  };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const today = new Date().toISOString().slice(0, 10);
  ws.addRow({ barcode: '2000000000001', cost: 123.45, valid_from: today });
  ws.addRow({ barcode: '2000000000002', cost: 0, valid_from: today });

  const hint = ws.addRow([
    'Заполни строки ниже: barcode = штрихкод товара, cost = себестоимость в ₽ (с копейками — через запятую или точку), valid_from = с какой даты эта цена. Дату можно вводить в формате YYYY-MM-DD или родной excel-датой.',
  ]);
  ws.mergeCells(`A${hint.number}:C${hint.number}`);
  hint.font = { italic: true, color: { argb: 'FF666666' }, size: 10 };
  hint.alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(hint.number).height = 60;

  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(buf as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="costs-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
