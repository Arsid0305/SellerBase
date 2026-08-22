'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { cn } from '@/shared/lib/utils';
import type { CsvColumn } from '@/shared/lib/csv';
import { checkTitle, type SeoOverview, type SeoSkuRow } from '@/entities/seo';
import { SeoSummaryCards } from './seo-summary';
import { SeoFindings } from './seo-findings';
import { SeoSkuDetail } from './seo-detail';
import { seoColumns } from './seo-columns';

type StatusFilter = 'all' | 'risk-r' | 'risk-a' | 'missing-key' | 'clean';

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'risk-r', label: 'Высокий риск' },
  { key: 'risk-a', label: 'Средний риск' },
  { key: 'missing-key', label: 'Нет ключа' },
  { key: 'clean', label: 'Без замечаний' },
];

function matchesStatus(row: SeoSkuRow, f: StatusFilter): boolean {
  switch (f) {
    case 'all':
      return true;
    case 'risk-r':
      return row.nRiskR > 0;
    case 'risk-a':
      return row.nRiskA > 0;
    case 'missing-key':
      return row.nMissingG > 0;
    case 'clean':
      return row.nTotal === 0;
  }
}

function matchesSearch(row: SeoSkuRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.myArticle.toLowerCase().includes(needle) ||
    (row.wbArticle ?? '').toString().includes(needle) ||
    (row.title ?? '').toLowerCase().includes(needle) ||
    (row.subjectName ?? '').toLowerCase().includes(needle) ||
    row.issues.some((i) => i.finding.toLowerCase().includes(needle))
  );
}

const CSV_COLUMNS: CsvColumn<SeoSkuRow>[] = [
  { key: 'myArticle', label: 'Мой артикул' },
  { key: 'wbArticle', label: 'Артикул WB' },
  { key: 'title', label: 'Наименование' },
  { key: 'subjectName', label: 'Предмет WB' },
  { key: 'descLen', label: 'Длина описания' },
  { key: 'charCount', label: 'Характеристик' },
  { key: 'nRiskR', label: 'Высокий риск' },
  { key: 'nRiskA', label: 'Средний риск' },
  { key: 'nMissingG', label: 'Нет ключа' },
  { key: 'nTotal', label: 'Замечаний всего' },
  {
    key: 'issues',
    label: 'Находки',
    format: (row) =>
      row.issues.map((i) => `${i.risk}: ${checkTitle(i.checkName)} — ${i.finding}`).join(' | '),
  },
];

export function SeoExplorer({
  data,
  initialArticle,
}: {
  data: SeoOverview;
  initialArticle?: string;
}) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [subject, setSubject] = useState<string>('all');
  const [finding, setFinding] = useState<string | null>(null);
  // ?article= из карточки товара: сразу показываем разбор нужного SKU
  const [selected, setSelected] = useState<string | null>(initialArticle ?? null);
  const [search, setSearch] = useState(initialArticle ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(initialArticle ?? '');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(
    () =>
      data.skus
        .filter((r) => matchesStatus(r, status))
        .filter((r) =>
          subject === 'all' ? true : (r.subjectName ?? '— без предмета —') === subject,
        )
        .filter((r) => (finding == null ? true : r.issues.some((i) => i.finding === finding)))
        .filter((r) => matchesSearch(r, debouncedSearch)),
    [data.skus, status, subject, finding, debouncedSearch],
  );

  const columns = useMemo(() => seoColumns({ selected, onSelect: setSelected }), [selected]);

  const selectedSku = useMemo(
    () => (selected ? (data.skus.find((s) => s.myArticle === selected) ?? null) : null),
    [data.skus, selected],
  );

  const filtersDirty = status !== 'all' || subject !== 'all' || finding != null || search !== '';

  return (
    <div className="flex flex-col gap-6">
      <SeoSummaryCards totals={data.totals} />

      <SeoFindings findings={data.topFindings} active={finding} onSelect={setFinding} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-md min-w-[240px] flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по артикулу, наименованию, предмету, находке…"
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-9 w-full rounded-md border pr-3 pl-9 text-sm focus-visible:ring-1 focus-visible:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_CHIPS.map((c) => {
              const active = status === c.key;
              return (
                <Button
                  key={c.key}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className={cn(!active && 'text-muted-foreground')}
                  onClick={() => setStatus(c.key)}
                >
                  {c.label}
                </Button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {filtered.length} из {data.skus.length}
            </span>
            <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="seo-kartochki" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
          >
            <option value="all">Все предметы WB</option>
            {data.groups.map((g) => (
              <option key={g.subjectName} value={g.subjectName}>
                {g.subjectName} · {g.skuCount} SKU
                {g.withRiskR > 0 ? ` · ${g.withRiskR} с риском` : ''}
              </option>
            ))}
          </select>
          {finding && (
            <span className="bg-accent/60 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs">
              находка: {finding}
            </span>
          )}
          {filtersDirty && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs"
              onClick={() => {
                setStatus('all');
                setSubject('all');
                setFinding(null);
                setSearch('');
              }}
            >
              Сбросить фильтры
            </Button>
          )}
        </div>
      </div>

      {selectedSku && <SeoSkuDetail sku={selectedSku} onClose={() => setSelected(null)} />}

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.myArticle}
        rowClassName={(row) => (row.myArticle === selected ? 'bg-accent/40' : undefined)}
        empty="Ничего не найдено. Попробуйте изменить фильтры."
      />
    </div>
  );
}
