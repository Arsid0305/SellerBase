/**
 * CSV-export utility — без внешних зависимостей.
 * Разделитель `;` + BOM UTF-8 — чтобы Excel в RU-локали открывал корректно.
 */

export type CsvColumn<T> = {
  key: keyof T | string;
  label: string;
  format?: (row: T) => string | number;
};

export function downloadCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(';');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = c.format ? c.format(row) : row[c.key as keyof T];
        return escapeCsvCell(formatValue(raw));
      })
      .join(';'),
  );
  const csv = '﻿' + [header, ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function formatValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (Array.isArray(value)) return value.join(' / ');
  return String(value);
}

function escapeCsvCell(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
