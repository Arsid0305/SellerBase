'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { PriceSimulatorRow } from '@/entities/price-simulator';

type Tone = 'rose' | 'amber' | 'muted' | 'emerald';

function marginTone(marginPct: number): Tone {
  if (marginPct < 0) return 'rose';
  if (marginPct < 15) return 'amber';
  if (marginPct < 30) return 'muted';
  return 'emerald';
}

const TONE_CLASS: Record<Tone, string> = {
  rose: 'text-rose-500',
  amber: 'text-amber-500',
  muted: 'text-muted-foreground',
  emerald: 'text-emerald-500',
};

function matchesSearch(row: PriceSimulatorRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.title.toLowerCase().includes(needle) ||
    (row.myArticle ?? '').toLowerCase().includes(needle) ||
    (row.wbArticle != null ? String(row.wbArticle) : '').includes(needle) ||
    (row.barcode ?? '').toLowerCase().includes(needle)
  );
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function PriceSimulatorClient({ rows }: { rows: PriceSimulatorRow[] }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [price, setPrice] = useState<number>(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesSearch(r, debouncedSearch)),
    [rows, debouncedSearch],
  );

  const selected = useMemo(
    () => rows.find((r) => r.skuId === selectedId) ?? null,
    [rows, selectedId],
  );

  const range = useMemo(() => {
    if (!selected) return { min: 0, max: 0 };
    const min = Math.max(50, roundToStep(selected.breakEven * 0.7, 10));
    const max = Math.max(min + 10, roundToStep(selected.currentPrice * 2, 10));
    return { min, max };
  }, [selected]);

  function selectSku(row: PriceSimulatorRow) {
    setSelectedId(row.skuId);
    setPrice(Math.round(row.currentPrice));
  }

  function resetPrice() {
    if (selected) setPrice(Math.round(selected.currentPrice));
  }

  const sim = useMemo(() => {
    if (!selected) return null;
    const profitPerUnit = price - selected.totalCostPerUnit;
    const marginPct = price > 0 ? (profitPerUnit / price) * 100 : 0;
    const profit30d = profitPerUnit * selected.unitsSold30d;
    return { profitPerUnit, marginPct, profit30d };
  }, [selected, price]);

  const current = useMemo(() => {
    if (!selected) return null;
    const profitPerUnit = selected.currentPrice - selected.totalCostPerUnit;
    const marginPct = selected.currentPrice > 0 ? (profitPerUnit / selected.currentPrice) * 100 : 0;
    return { profitPerUnit, marginPct };
  }, [selected]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Выбор товара</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, артикулу, штрихкоду…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Нет товаров с данными для симуляции (нужны: себестоимость и продажи за 30 дней).
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              {filtered.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Ничего не найдено.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((row) => (
                    <li key={row.skuId}>
                      <button
                        type="button"
                        onClick={() => selectSku(row)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                          selectedId === row.skuId && 'bg-accent',
                        )}
                      >
                        <SkuThumb src={row.photoUrl} alt={row.title} size="sm" />
                        <span className="flex-1 truncate">{row.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {row.myArticle ?? row.wbArticle ?? '—'}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums">{formatRub(row.currentPrice)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && sim && current && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <SkuThumb src={selected.photoUrl} alt={selected.title} size="md" />
              <div className="flex flex-col">
                <CardTitle className="text-base">{selected.title}</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {selected.myArticle ?? selected.wbArticle ?? selected.barcode ?? '—'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Текущая цена</span>
                <span className="text-sm font-medium tabular-nums">{formatRub(selected.currentPrice)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  Текущая маржа
                  <TooltipIcon text="(цена − полная себестоимость единицы) / цена × 100%" />
                </span>
                <span className={cn('text-sm font-medium tabular-nums', TONE_CLASS[marginTone(current.marginPct)])}>
                  {current.marginPct.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Прибыль на ед.</span>
                <span className={cn('text-sm font-medium tabular-nums', TONE_CLASS[marginTone(current.marginPct)])}>
                  {formatRub(current.profitPerUnit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Продано за 30д</span>
                <span className="text-sm font-medium tabular-nums">{formatInt(selected.unitsSold30d)} шт</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  Точка безубыточности
                  <TooltipIcon text="Цена при которой маржа = 0% с учётом себестоимости, логистики, хранения, комиссии, эквайринга, налога и возвратов" />
                </span>
                <span className="text-sm font-medium tabular-nums">{formatRub(selected.breakEven)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Симулятор</CardTitle>
              <Button variant="outline" size="sm" onClick={resetPrice}>
                Сбросить к текущей цене
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={10}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="flex-1"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={range.min}
                    max={range.max}
                    step={10}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <span className="text-sm text-muted-foreground">₽</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Маржа
                    <TooltipIcon text="(цена − полная себестоимость единицы) / цена × 100%" />
                  </div>
                  <div className={cn('mt-1 text-lg font-semibold tabular-nums', TONE_CLASS[marginTone(sim.marginPct)])}>
                    {sim.marginPct.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Прибыль на ед.
                    <TooltipIcon text="Цена минус полная себестоимость единицы (себес + логистика + хранение + комиссия + эквайринг + налог − доля возвратов)" />
                  </div>
                  <div className={cn('mt-1 text-lg font-semibold tabular-nums', TONE_CLASS[marginTone(sim.marginPct)])}>
                    {formatRub(sim.profitPerUnit)}
                  </div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Прибыль за 30д
                    <TooltipIcon text="Прогноз: прибыль на ед. × текущий объём продаж за 30 дней. Не учитывает влияние цены на спрос." />
                  </div>
                  <div className={cn('mt-1 text-lg font-semibold tabular-nums', TONE_CLASS[marginTone(sim.marginPct)])}>
                    {formatRub(sim.profit30d)}
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Диапазон цены: {formatRub(range.min)} – {formatRub(range.max)}. Прогноз прибыли исходит из текущего
                объёма продаж и не учитывает реакцию спроса на изменение цены.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
