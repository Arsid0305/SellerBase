'use client';

import { useMemo, useState, useTransition } from 'react';
import { Download, Check, X, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { PromoSkuRow, PromoSummary } from '@/entities/promo';
import { setParticipationAction, bulkSetParticipationAction } from './actions';

type Filter = 'all' | 'recommended' | 'participate' | 'pending' | 'declined';

const fmtRub = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';

const fmtPct = (p: number | null) =>
  p == null ? '—' : (p * 100).toFixed(1).replace('.', ',') + '%';

const fmtTurnover = (d: number | null) => (d == null ? '—' : `${d} д`);

function marginColor(pct: number | null) {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 0.25) return 'text-emerald-600';
  if (pct >= 0.15) return 'text-amber-600';
  if (pct >= 0) return 'text-orange-600';
  return 'text-red-600';
}

function turnoverColor(days: number | null) {
  if (days == null) return 'text-muted-foreground';
  if (days > 90) return 'text-red-600';
  if (days >= 60) return 'text-amber-600';
  return 'text-emerald-600';
}

export function PromoDetailClient({ promo, rows }: { promo: PromoSummary; rows: PromoSkuRow[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, startTransition] = useTransition();

  const filtered = useMemo(() => {
    switch (filter) {
      case 'recommended':
        return rows.filter((r) => r.recommended);
      case 'participate':
        return rows.filter((r) => r.userParticipate === true);
      case 'pending':
        return rows.filter((r) => r.userParticipate == null);
      case 'declined':
        return rows.filter((r) => r.userParticipate === false);
      default:
        return rows;
    }
  }, [filter, rows]);

  const recommendedIds = useMemo(
    () => rows.filter((r) => r.recommended).map((r) => r.nmId),
    [rows],
  );

  const handleSet = (nmId: number, participate: boolean | null) => {
    startTransition(async () => {
      await setParticipationAction(promo.promotionId, nmId, participate);
    });
  };

  const handleBulkRecommended = () => {
    if (recommendedIds.length === 0) return;
    startTransition(async () => {
      await bulkSetParticipationAction(promo.promotionId, recommendedIds, true);
    });
  };

  const handleClearAll = () => {
    const ids = rows.filter((r) => r.userParticipate === true).map((r) => r.nmId);
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkSetParticipationAction(promo.promotionId, ids, false);
    });
  };

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Все', count: rows.length },
    { key: 'recommended', label: 'Рекомендуемые', count: recommendedIds.length },
    {
      key: 'participate',
      label: 'Участвую',
      count: rows.filter((r) => r.userParticipate === true).length,
    },
    { key: 'pending', label: 'Не решено', count: promo.pendingCount },
    {
      key: 'declined',
      label: 'Отказался',
      count: rows.filter((r) => r.userParticipate === false).length,
    },
  ];

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

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || recommendedIds.length === 0}
            onClick={handleBulkRecommended}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> Выбрать рекомендуемые
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleClearAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Снять все
          </button>
          <a
            href={`/api/promo/${promo.promotionId}/export-xlsx`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-3.5 w-3.5" /> Excel для WB-кабинета
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Товар</th>
              <th className="px-3 py-2 text-right">Остаток</th>
              <th className="px-3 py-2 text-right">Оборачиваемость</th>
              <th className="px-3 py-2 text-right">Цена сейчас</th>
              <th className="px-3 py-2 text-right">Маржа сейчас</th>
              <th className="px-3 py-2 text-right">Цена при акции</th>
              <th className="px-3 py-2 text-right">Маржа при акции</th>
              <th className="px-3 py-2 text-right">Δ маржа</th>
              <th className="px-3 py-2 text-center">Участвую</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  Нет товаров под этот фильтр
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const deltaRub =
                  r.marginPromoRub != null && r.marginCurrentRub != null
                    ? r.marginPromoRub - r.marginCurrentRub
                    : null;
                return (
                  <tr
                    key={r.nmId}
                    className={cn(
                      'border-b border-border last:border-b-0 transition',
                      r.recommended && 'bg-amber-50/30 dark:bg-amber-950/10',
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="line-clamp-1 max-w-xs font-medium">
                        {r.title ?? r.myArticle ?? `nm ${r.nmId}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.myArticle && <span>{r.myArticle} · </span>}
                        <a
                          href={`https://www.wildberries.ru/catalog/${r.nmId}/detail.aspx`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {r.nmId}
                        </a>
                        {r.subjectName && <span> · {r.subjectName}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.stockUnits}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', turnoverColor(r.turnoverDays))}>
                      {fmtTurnover(r.turnoverDays)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtRub(r.currentPrice)}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', marginColor(r.marginCurrentPct))}>
                      <div>{fmtPct(r.marginCurrentPct)}</div>
                      <div className="text-xs text-muted-foreground">{fmtRub(r.marginCurrentRub)}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtRub(r.planPrice)}
                      {r.planDiscount != null && (
                        <div className="text-xs text-muted-foreground">−{r.planDiscount}%</div>
                      )}
                    </td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', marginColor(r.marginPromoPct))}>
                      <div>{fmtPct(r.marginPromoPct)}</div>
                      <div className="text-xs text-muted-foreground">{fmtRub(r.marginPromoRub)}</div>
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums text-xs',
                        deltaRub != null && deltaRub < 0 ? 'text-red-600' : 'text-muted-foreground',
                      )}
                    >
                      {deltaRub == null ? '—' : fmtRub(deltaRub)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSet(r.nmId, r.userParticipate === true ? null : true)}
                          className={cn(
                            'rounded p-1 transition disabled:opacity-50',
                            r.userParticipate === true
                              ? 'bg-emerald-500 text-white'
                              : 'border border-border text-muted-foreground hover:text-emerald-600',
                          )}
                          aria-label="Участвую"
                        >
                          {busy && r.userParticipate !== true ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSet(r.nmId, r.userParticipate === false ? null : false)}
                          className={cn(
                            'rounded p-1 transition disabled:opacity-50',
                            r.userParticipate === false
                              ? 'bg-red-500 text-white'
                              : 'border border-border text-muted-foreground hover:text-red-600',
                          )}
                          aria-label="Отказался"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Рекомендация автоподсветки: оборачиваемость &gt;90 дней или 60–90 дней при марже акции ≥10%.
        Маржа: цена − себес − комиссия по категории − средневзвешенный тариф WB (логистика + хранение по фактическим складам) − УСН.
        Excel-выгрузка — в формате шаблона WB «Установка цен на товар» (лист <code>prices</code>): автозаполняет
        новые цены/скидки только для отмеченных «Участвую». Загружается в кабинет WB как есть.
      </p>
    </div>
  );
}
