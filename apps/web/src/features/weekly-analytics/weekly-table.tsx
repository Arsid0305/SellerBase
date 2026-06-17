'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Download } from 'lucide-react';
import { formatInt, formatRub } from '@/shared/lib/format';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import type { WeeklySummaryPoint } from '@/entities/sku-weekly';

export function WeeklyTable({ rows, year }: { rows: WeeklySummaryPoint[]; year: number }) {
  function exportCsv() {
    const header = ['Неделя', 'Единиц продано', 'Выручка', 'Прибыль', 'Маржа %', 'Оборачиваемость, дн (среднее)'];
    const lines = [header.join(';')];
    for (const r of rows) {
      lines.push([
        r.week_num,
        r.units_sold,
        Math.round(r.revenue),
        Math.round(r.profit),
        r.margin_pct.toFixed(2).replace('.', ','),
        r.turnover_days_avg.toFixed(1).replace('.', ','),
      ].join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-analytics-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Сводная таблица недель {year}</CardTitle>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="mr-1.5 size-3.5" />
          CSV
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Нет данных за {year}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2">Неделя</th>
                  <th className="px-2 py-2 text-right">Единиц продано</th>
                  <th className="px-2 py-2 text-right">Выручка</th>
                  <th className="px-2 py-2 text-right">Прибыль</th>
                  <th className="px-2 py-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      Маржа
                      <TooltipIcon text="Прибыль за неделю, делённая на выручку за неделю." />
                    </span>
                  </th>
                  <th className="px-2 py-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      Оборачиваемость, дн
                      <TooltipIcon text="Среднее число дней, на которое хватит текущего остатка товара при текущей скорости продаж." />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.week_num} className="border-b last:border-0">
                    <td className="px-2 py-2 font-mono tabular-nums">№{r.week_num}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatInt(r.units_sold)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatRub(r.revenue)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${r.profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatRub(r.profit)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.margin_pct.toFixed(1)}%</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.turnover_days_avg.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
