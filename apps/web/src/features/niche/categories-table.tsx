'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/ui/dropdown-menu';
import type { CsvColumn } from '@/shared/lib/csv';
import { categoriesColumns } from './categories-columns';
import type { NicheCategory } from './types';

const CSV_COLUMNS: CsvColumn<NicheCategory>[] = [
  { key: 'name', label: 'Категория' },
  { key: 'sellersCount', label: 'Продавцов' },
  { key: 'productsCount', label: 'Товаров' },
  { key: 'monthlyRevenue', label: 'Выручка/мес ₽' },
  { key: 'avgPrice', label: 'Средний чек ₽' },
  { key: 'topBrandShare', label: 'Доля топ-бренда %' },
  { key: 'competitiveness', label: 'Конкуренция (1-10)' },
];

const ALL = '__all__';

export function CategoriesTable({ categories }: { categories: NicheCategory[] }) {
  const [selected, setSelected] = useState<string>(ALL);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minRevenue, setMinRevenue] = useState<string>('');

  const filtered = useMemo(() => {
    const minP = Number(minPrice) || 0;
    const maxP = Number(maxPrice) || Infinity;
    const minR = Number(minRevenue) || 0;
    return categories.filter(
      (c) =>
        (selected === ALL || c.name === selected) &&
        c.avgPrice >= minP &&
        c.avgPrice <= maxP &&
        c.monthlyRevenue >= minR,
    );
  }, [categories, selected, minPrice, maxPrice, minRevenue]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Топ категорий</h2>
        <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="niche-categories" />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {selected === ALL ? 'Все категории' : selected}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            <DropdownMenuItem onSelect={() => setSelected(ALL)}>Все категории</DropdownMenuItem>
            {categories.map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => setSelected(c.name)}>
                {c.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <FilterInput value={minPrice} onChange={setMinPrice} placeholder="Цена от ₽" />
        <FilterInput value={maxPrice} onChange={setMaxPrice} placeholder="Цена до ₽" />
        <FilterInput value={minRevenue} onChange={setMinRevenue} placeholder="Мин. выручка ₽" widthClass="w-40" />
        <span className="ml-auto text-sm text-muted-foreground">
          Показано {filtered.length} из {categories.length}
        </span>
      </div>
      <DataTable
        data={filtered}
        columns={categoriesColumns}
        initialSort={[{ id: 'monthlyRevenue', desc: true }]}
        rowKey={(row) => row.id}
      />
    </div>
  );
}

function FilterInput({
  value,
  onChange,
  placeholder,
  widthClass = 'w-32',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  widthClass?: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-9 rounded-md border border-border bg-background px-3 text-sm tabular-nums outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40 ${widthClass}`}
    />
  );
}
