'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, X, Download, Loader2, ExternalLink, AlertTriangle, Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatRub, formatInt } from '@/shared/lib/format';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import type { MatrixPromo, MatrixSku } from '@/entities/promo/matrix-queries';
import { setParticipationAction, bulkSetParticipationAction } from './actions';
import { PriceCell } from './price-cell';

const fmtRub = (n: number | null) => (n == null ? '—' : formatRub(n));

const fmtPct = (p: number | null) =>
  p == null ? '—' : (p * 100).toFixed(1).replace('.', ',') + '%';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });

function marginColor(pct: number | null) {
  if (pct == null) return 'text-muted-foreground';
  if (pct < 0.15) return 'text-rose-600';
  if (pct < 0.25) return 'text-muted-foreground';
  return 'text-emerald-600';
}

type Light = 'green' | 'yellow' | 'red' | 'unknown';

function promoLight(marginCurrentPct: number | null, turnoverDays: number | null): Light {
  if (marginCurrentPct == null && turnoverDays == null) return 'unknown';
  const marginBad = marginCurrentPct != null && marginCurrentPct < 0.15;
  const stockBad = turnoverDays != null && turnoverDays < 7;
  if (marginBad || stockBad) return 'red';
  const marginOk = marginCurrentPct != null && marginCurrentPct >= 0.25;
  const stockOk = turnoverDays != null && turnoverDays >= 14;
  if (marginOk && stockOk) return 'green';
  return 'yellow';
}

const LIGHT_META: Record<Light, { dot: string; label: string }> = {
  green: { dot: 'bg-emerald-500', label: 'Можно в акцию: маржа ≥25% и остаток ≥14 дней' },
  yellow: { dot: 'bg-amber-500', label: 'На грани: маржа 15–25% или остаток 7–14 дней' },
  red: { dot: 'bg-rose-500', label: 'Не выгодно: маржа <15% или остаток <7 дней' },
  unknown: { dot: 'bg-muted-foreground/40', label: 'Недостаточно данных' },
};

function matchesSearch(sku: MatrixSku, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    (sku.title ?? '').toLowerCase().includes(needle) ||
    (sku.myArticle ?? '').toLowerCase().includes(needle) ||
    (sku.barcode ?? '').toLowerCase().includes(needle) ||
    String(sku.nmId).includes(needle)
  );
}

const CELL_LIGHT_BG: Record<'green' | 'yellow' | 'red' | 'unknown', string> = {
  green: 'bg-emerald-50 dark:bg-emerald-950/20 border-l-2 border-l-emerald-500',
  yellow: 'bg-amber-50 dark:bg-amber-950/15 border-l-2 border-l-amber-500',
  red: 'bg-rose-50 dark:bg-rose-950/15 border-l-2 border-l-rose-500',
  unknown: '',
};

const CELL_LIGHT_TITLE: Record<'green' | 'yellow' | 'red' | 'unknown', string> = {
  green: 'Можно в акцию: маржа после скидки ≥25% или срочно сливать (>90д) с маржой ≥10%',
  yellow: 'На грани: маржа 10–25%, оборачиваемость нормальная',
  red: 'Не выгодно: маржа после акции <10% или остатков <7 дней (упустишь выручку)',
  unknown: 'Нет данных по марже',
};

function turnoverColor(days: number | null) {
  if (days == null) return 'text-muted-foreground';
  if (days > 90) return 'text-red-600';
  if (days >= 60) return 'text-amber-600';
  return 'text-emerald-600';
}

type Filter = 'all' | 'in-any' | 'recommended-any';

export function PromoMatrixClient({
  promos,
  skus,
}: {
  promos: MatrixPromo[];
  skus: MatrixSku[];
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    const byFilter = (() => {
      switch (filter) {
        case 'in-any':
          return skus.filter((s) => Object.values(s.cells).some((c) => c.inPromo));
        case 'recommended-any':
          return skus.filter((s) => Object.values(s.cells).some((c) => c.recommended));
        default:
          return skus;
      }
    })();
    return byFilter.filter((s) => matchesSearch(s, debouncedSearch));
  }, [filter, skus, debouncedSearch]);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Все товары', count: skus.length },
    {
      key: 'in-any',
      label: 'Есть в акциях',
      count: skus.filter((s) => Object.values(s.cells).some((c) => c.inPromo)).length,
    },
    {
      key: 'recommended-any',
      label: 'Рекомендуем',
      count: skus.filter((s) => Object.values(s.cells).some((c) => c.recommended)).length,
    },
  ];

  const handleToggle = (
    promotionId: number,
    nmId: number,
    current: boolean | null,
  ) => {
    const key = `${promotionId}:${nmId}`;
    const next = current === true ? null : true;
    setBusyKey(key);
    startTransition(async () => {
      await setParticipationAction(promotionId, nmId, next);
      setBusyKey(null);
    });
  };

  const handleSelectRecommendedForPromo = (promotionId: number) => {
    const nmIds = skus
      .filter((s) => s.cells[promotionId]?.recommended)
      .map((s) => s.nmId);
    if (nmIds.length === 0) return;
    startTransition(async () => {
      await bulkSetParticipationAction(promotionId, nmIds, true);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition',
                filter === f.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label} · {f.count}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск: артикул, штрихкод, nm, название…"
            className="w-full rounded-md border border-border bg-card py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      {promos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Сейчас нет активных или ближайших (30 дней) акций WB.
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th
                  className="sticky left-0 top-0 z-30 min-w-[280px] border-r border-border bg-muted/60 px-3 py-2 text-left"
                  rowSpan={2}
                >
                  Товар
                </th>
                <th
                  className="sticky top-0 z-20 min-w-[80px] border-r border-border bg-muted/40 px-3 py-2 text-right"
                  rowSpan={2}
                >
                  Остаток
                </th>
                <th
                  className="sticky top-0 z-20 min-w-[110px] border-r border-border bg-muted/40 px-3 py-2 text-right"
                  rowSpan={2}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Оборачив.
                    <TooltipIcon text="Дней до распродажи остатка при текущем темпе продаж. >90 дн — красный, 60–90 дн — жёлтый." />
                  </span>
                </th>
                <th
                  className="sticky top-0 z-20 min-w-[100px] border-r border-border bg-muted/40 px-3 py-2 text-right"
                  rowSpan={2}
                >
                  Цена
                </th>
                <th
                  className="sticky top-0 z-20 min-w-[110px] border-r-2 border-border bg-muted/40 px-3 py-2 text-right"
                  rowSpan={2}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Маржа сейчас
                    <TooltipIcon text="Маржа по текущей цене: <15% — внимание, 15–25% — норма, ≥25% — хорошо." />
                  </span>
                </th>
                {promos.map((p) => (
                  <th
                    key={p.promotionId}
                    className="min-w-[160px] border-r border-border bg-muted/40 px-3 py-2 text-left align-top"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <Link
                          href={`/promo/${p.promotionId}`}
                          className="line-clamp-2 text-xs font-medium hover:text-primary"
                          title={p.name}
                        >
                          {p.name}
                        </Link>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {p.type === 'auto' && (
                            <span className="mr-1 inline-flex items-center gap-0.5 text-red-600">
                              <AlertTriangle className="h-2.5 w-2.5" /> auto
                            </span>
                          )}
                          {fmtDate(p.startAt)} – {fmtDate(p.endAt)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleSelectRecommendedForPromo(p.promotionId)}
                          className="rounded border border-border bg-card p-1 text-muted-foreground hover:text-emerald-600"
                          title="Выбрать рекомендуемые"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <a
                          href={`/api/promo/${p.promotionId}/export-xlsx`}
                          className="rounded border border-border bg-card p-1 text-muted-foreground hover:text-primary"
                          title="Скачать XLSX для WB-кабинета"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5 + promos.length}
                    className="px-3 py-8 text-center text-xs text-muted-foreground"
                  >
                    Нет данных — ничего не найдено под текущий фильтр и поиск
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <SkuMatrixRow
                    key={s.nmId}
                    sku={s}
                    promos={promos}
                    busyKey={busyKey}
                    onToggle={handleToggle}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Строки — все товары из каталога; колонки — активные и ближайшие (30 дней) акции WB.
        В ячейке: плановая цена со скидкой, маржа при этой цене, чекбокс «Участвую».
        Подсвеченная жёлтым ячейка = рекомендация (оборачиваемость &gt;90 д или 60–90 д при марже ≥10%).
        Авто-акции помечены красным «auto» — выйти из них можно только в ЛК WB.
        Клик по названию акции → детальная страница; кнопка Excel в шапке колонки → выгрузка цен в шаблон WB.
      </p>
    </div>
  );
}

function SkuMatrixRow({
  sku,
  promos,
  busyKey,
  onToggle,
}: {
  sku: MatrixSku;
  promos: MatrixPromo[];
  busyKey: string | null;
  onToggle: (promotionId: number, nmId: number, current: boolean | null) => void;
}) {
  return (
    <tr className="border-t border-border">
      <td className="sticky left-0 z-10 min-w-[280px] border-r border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          {(() => {
            const light = promoLight(sku.marginCurrentPct, sku.turnoverDays);
            const m = LIGHT_META[light];
            return (
              <span
                className={cn('h-2.5 w-2.5 shrink-0 rounded-full', m.dot)}
                title={m.label}
                aria-label={m.label}
              />
            );
          })()}
          {sku.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sku.photoUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded object-cover"
            />
          )}
          <div className="min-w-0">
            <div className="line-clamp-1 text-sm font-medium">
              {sku.title ?? sku.myArticle ?? `nm ${sku.nmId}`}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {sku.myArticle && <span>{sku.myArticle} · </span>}
              <a
                href={`https://www.wildberries.ru/catalog/${sku.nmId}/detail.aspx`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 hover:underline"
              >
                {sku.nmId}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
              {sku.subjectName && <span> · {sku.subjectName}</span>}
            </div>
          </div>
        </div>
      </td>
      <td className="border-r border-border px-3 py-2 text-right tabular-nums">
        {formatInt(sku.stockUnits)}
      </td>
      <td
        className={cn(
          'border-r border-border px-3 py-2 text-right tabular-nums text-xs',
          turnoverColor(sku.turnoverDays),
        )}
      >
        {sku.turnoverDays == null ? '—' : `${sku.turnoverDays} д`}
      </td>
      <td className="border-r border-border px-3 py-2 text-right tabular-nums">
        <PriceCell currentPrice={sku.currentPrice} history={sku.priceHistory} />
      </td>
      <td
        className={cn(
          'border-r-2 border-border px-3 py-2 text-right tabular-nums',
          marginColor(sku.marginCurrentPct),
        )}
      >
        {fmtPct(sku.marginCurrentPct)}
      </td>
      {promos.map((p) => {
        const cell = sku.cells[p.promotionId];
        const key = `${p.promotionId}:${sku.nmId}`;
        const busy = busyKey === key;
        if (!cell || !cell.inPromo) {
          return (
            <td
              key={p.promotionId}
              className="border-r border-border bg-muted/10 px-3 py-2 text-center text-xs text-muted-foreground"
            >
              —
            </td>
          );
        }
        return (
          <td
            key={p.promotionId}
            className={cn(
              'border-r border-border px-3 py-2 align-middle',
              CELL_LIGHT_BG[cell.light],
            )}
            title={CELL_LIGHT_TITLE[cell.light]}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs">
                <div className="tabular-nums">{fmtRub(cell.planPrice)}</div>
                <div className={cn('tabular-nums', marginColor(cell.marginPromoPct))}>
                  {fmtPct(cell.marginPromoPct)}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggle(p.promotionId, sku.nmId, cell.userParticipate)}
                className={cn(
                  'rounded p-1 transition disabled:opacity-50',
                  cell.userParticipate === true
                    ? 'bg-emerald-500 text-white'
                    : cell.userParticipate === false
                      ? 'border border-red-300 text-red-600'
                      : 'border border-border text-muted-foreground hover:text-emerald-600',
                )}
                aria-label="Участвую"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : cell.userParticipate === false ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </td>
        );
      })}
    </tr>
  );
}
