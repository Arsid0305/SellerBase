'use client';

import { Download } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { downloadCsv, type CsvColumn } from '@/shared/lib/csv';

export function ExportCsvButton<T>({
  rows,
  columns,
  filename,
  label = 'Экспорт CSV',
  disabled,
}: {
  rows: T[];
  columns: CsvColumn<T>[];
  filename: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => downloadCsv(rows, columns, filename)}
      disabled={disabled || rows.length === 0}
    >
      <Download className="size-4" />
      {label}
    </Button>
  );
}
