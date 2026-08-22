'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/shared/ui/button';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { cn } from '@/shared/lib/utils';
import { formatInt } from '@/shared/lib/format';
import type { SeoSkuRow } from '@/entities/seo';
import { RISK_META } from './risk-badge';

const RISK_TOOLTIP =
  'R — меняет классификацию товара или требует разрешительных документов. A — довод против собственной карточки. G — рабочий ключ группы, его отсутствие само по себе дефект.';

const TRAFFIC_TOOLTIP =
  'Просмотры, корзина и заказы за 30 дней — из воронки WB. Чинить в первую очередь имеет смысл там, где карточку видят: правка описания у SKU без просмотров ничего не изменит. Низкая конверсия в корзину при живых просмотрах — признак того, что не убеждают наименование, фото и описание.';

const LEN_TOOLTIP =
  'Целевая длина описания 1500–2000 знаков: короче — не хватает ключей, длиннее — WB режет выдачу в карточке.';

function CountCell({ n, tone }: { n: number; tone: string }) {
  if (n === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className={cn('font-medium tabular-nums', tone)}>{n}</span>;
}

export function seoColumns(opts: {
  selected: string | null;
  onSelect: (article: string | null) => void;
}): ColumnDef<SeoSkuRow, unknown>[] {
  return [
    {
      accessorKey: 'title',
      header: 'Карточка',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex min-w-[240px] items-center gap-2">
          <SkuThumb
            src={row.original.photoUrl}
            alt={row.original.title ?? row.original.myArticle}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="line-clamp-2 leading-tight font-medium">
              {row.original.title ?? '— без наименования —'}
            </span>
            <span className="text-muted-foreground font-mono text-[11px]">
              {row.original.myArticle}
              {row.original.wbArticle ? ` · WB ${row.original.wbArticle}` : ''}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'subjectName',
      header: 'Предмет WB',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.subjectName ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'nRiskR',
      header: () => (
        <span className="inline-flex items-center gap-1">
          R<TooltipIcon text={RISK_TOOLTIP} />
        </span>
      ),
      cell: ({ row }) => (
        <CountCell n={row.original.nRiskR} tone="text-rose-600 dark:text-rose-400" />
      ),
    },
    {
      accessorKey: 'nRiskA',
      header: 'A',
      cell: ({ row }) => (
        <CountCell n={row.original.nRiskA} tone="text-amber-600 dark:text-amber-400" />
      ),
    },
    {
      accessorKey: 'nMissingG',
      header: 'G',
      cell: ({ row }) => (
        <CountCell n={row.original.nMissingG} tone="text-sky-600 dark:text-sky-400" />
      ),
    },
    {
      accessorKey: 'views30d',
      header: () => (
        <span className="inline-flex items-center gap-1">
          Трафик 30д
          <TooltipIcon text={TRAFFIC_TOOLTIP} />
        </span>
      ),
      cell: ({ row }) => {
        const { views30d, orders30d, crCartPct } = row.original;
        if (views30d === 0)
          return <span className="text-muted-foreground text-xs">нет показов</span>;
        return (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-medium tabular-nums">{formatInt(views30d)} просм.</span>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {crCartPct != null ? `${crCartPct}% в корзину · ` : ''}
              {formatInt(orders30d)} зак.
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'descLen',
      header: () => (
        <span className="inline-flex items-center gap-1">
          Описание
          <TooltipIcon text={LEN_TOOLTIP} />
        </span>
      ),
      cell: ({ row }) => {
        const len = row.original.descLen;
        const tone =
          len === 0
            ? 'text-rose-600 dark:text-rose-400 font-semibold'
            : len < 1500 || len > 2000
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-foreground';
        return <span className={cn('tabular-nums', tone)}>{len} зн.</span>;
      },
    },
    {
      accessorKey: 'charCount',
      header: 'Характеристик',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.charCount === 0 ? (
            <span className="font-semibold text-rose-600 dark:text-rose-400">0</span>
          ) : (
            row.original.charCount
          )}
        </span>
      ),
    },
    {
      accessorKey: 'nTotal',
      header: 'Итого',
      cell: ({ row }) => {
        const n = row.original.nTotal;
        if (n === 0) {
          return (
            <span
              className={cn(
                'rounded border px-2 py-0.5 text-[10px] font-medium uppercase',
                'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
              )}
            >
              чисто
            </span>
          );
        }
        const meta = row.original.nRiskR > 0 ? RISK_META.R : RISK_META.A;
        return (
          <span
            className={cn('rounded border px-2 py-0.5 text-xs font-medium tabular-nums', meta.tone)}
          >
            {n}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const isOpen = opts.selected === row.original.myArticle;
        return (
          <Button
            variant={isOpen ? 'default' : 'ghost'}
            size="sm"
            className={cn('text-xs', !isOpen && 'text-muted-foreground')}
            disabled={row.original.nTotal === 0}
            onClick={() => opts.onSelect(isOpen ? null : row.original.myArticle)}
          >
            {isOpen ? 'Скрыть' : 'Разбор'}
          </Button>
        );
      },
    },
  ];
}
