'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { Button } from '@/shared/ui/button';
import { useFiltersStore } from '@/shared/stores/filters';
import { cn } from '@/shared/lib/utils';
import type { CsvColumn } from '@/shared/lib/csv';
import { ReviewsSummaryCards } from './reviews-summary';
import { RatingDistribution } from './rating-distribution';
import { reviewsColumns } from './reviews-columns';
import { buildReviewsSummary } from './mock-data';
import type { Review } from './types';

const CSV_COLUMNS: CsvColumn<Review>[] = [
  { key: 'date', label: 'Дата' },
  { key: 'productName', label: 'Товар' },
  { key: 'productBarcode', label: 'Штрихкод' },
  { key: 'channel', label: 'Канал' },
  { key: 'rating', label: 'Оценка' },
  { key: 'author', label: 'Автор' },
  { key: 'text', label: 'Текст' },
  { key: 'sentiment', label: 'Тональность' },
  { key: 'responseStatus', label: 'Статус ответа' },
];

type Chip =
  | { id: 'all'; label: 'Все' }
  | { id: '5' | '4' | '3' | '2' | '1'; label: string }
  | { id: 'unanswered'; label: 'Без ответа' };

const CHIPS: Chip[] = [
  { id: 'all', label: 'Все' },
  { id: '5', label: '5★' },
  { id: '4', label: '4★' },
  { id: '3', label: '3★' },
  { id: '2', label: '2★' },
  { id: '1', label: '1★' },
  { id: 'unanswered', label: 'Без ответа' },
];

export function ReviewsExplorer({ rows }: { rows: Review[] }) {
  const marketplaces = useFiltersStore((s) => s.marketplaces);
  const [chip, setChip] = useState<Chip['id']>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!marketplaces.includes(r.channel)) return false;
      if (chip === 'unanswered' && r.responseStatus === 'answered') return false;
      if (chip !== 'all' && chip !== 'unanswered' && r.rating !== Number(chip)) return false;
      if (q) {
        const hay = `${r.text} ${r.author} ${r.productName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, marketplaces, chip, query]);

  const summary = useMemo(() => buildReviewsSummary(filtered), [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <ReviewsSummaryCards summary={summary} />
      <RatingDistribution summary={summary} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((c) => (
            <Button
              key={c.id}
              type="button"
              size="sm"
              variant={chip === c.id ? 'default' : 'outline'}
              onClick={() => setChip(c.id)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по тексту, автору, товару"
            className={cn(
              'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-sm',
            )}
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              Показано {filtered.length} из {rows.length}
            </span>
            <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="reviews" />
          </div>
        </div>

        <DataTable
          data={filtered}
          columns={reviewsColumns}
          initialSort={[{ id: 'date', desc: true }]}
          rowKey={(row) => row.id}
          empty="Нет отзывов по выбранным фильтрам"
        />
      </div>
    </div>
  );
}
