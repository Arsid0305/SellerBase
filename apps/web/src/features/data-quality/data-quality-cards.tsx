'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, CheckCircle2, Clock, CalendarX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { DataQualityReport, DataQualityCheck } from '@/entities/data-quality';

const SEVERITY_STYLE: Record<DataQualityCheck['severity'], { border: string; bg: string; text: string; badge: string }> = {
  ok: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  amber: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  rose: {
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/5',
    text: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  },
};

function CheckCard({ check }: { check: DataQualityCheck }) {
  const [open, setOpen] = useState(false);
  const style = SEVERITY_STYLE[check.severity];
  const hasItems = check.items.length > 0;

  return (
    <Card className={cn('flex flex-col', style.border, style.bg)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            {check.title}
            <TooltipIcon text={check.description} />
          </CardTitle>
        </div>
        {check.severity === 'ok' ? (
          <CheckCircle2 className={cn('size-5 shrink-0', style.text)} />
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
        <span className={cn('text-2xl font-semibold tabular-nums tracking-tight', style.text)}>
          {formatInt(check.count)}
        </span>
        {hasItems ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
            >
              {open ? 'Скрыть список' : `Показать первые ${check.items.length}`}
              {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
            {open ? (
              <ul className="flex flex-col gap-2">
                {check.items.map((item) => (
                  <li key={`${check.key}-${item.skuId}`} className="flex items-center gap-2">
                    <SkuThumb src={item.photoUrl} alt={item.title ?? ''} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${encodeURIComponent(String(item.skuId))}`}
                        className="block truncate text-xs font-medium hover:underline"
                        title={item.title ?? undefined}
                      >
                        {item.title ?? item.myArticle ?? `SKU ${item.skuId}`}
                      </Link>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {item.myArticle ?? '—'} {item.detail ? `· ${item.detail}` : ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Все данные в порядке ✓</span>
        )}
      </CardContent>
    </Card>
  );
}

function CronCard({ cron }: { cron: DataQualityReport['cron'] }) {
  if (cron.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
            Cron-задачи
            <TooltipIcon text="Журнал ingestion_log не найден или пуст — нет данных для проверки." />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">Нет данных о запусках</CardContent>
      </Card>
    );
  }
  const stale = cron.filter((c) => c.stale);
  const style = stale.length > 0 ? SEVERITY_STYLE.rose : SEVERITY_STYLE.ok;
  return (
    <Card className={cn('flex flex-col', style.border, style.bg)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
          Просроченные cron-задачи
          <TooltipIcon text="Последний успешный запуск каждой фоновой задачи синхронизации (ingestion_log). Если прошло больше 24 часов — данные могли устареть." />
        </CardTitle>
        {stale.length === 0 ? <CheckCircle2 className={cn('size-5 shrink-0', style.text)} /> : <Clock className={cn('size-5 shrink-0', style.text)} />}
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        <span className={cn('text-2xl font-semibold tabular-nums tracking-tight', style.text)}>
          {formatInt(stale.length)}
        </span>
        <ul className="flex flex-col gap-1.5">
          {cron.slice(0, 10).map((c) => (
            <li key={c.jobName} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{c.jobName}</span>
              <Badge
                variant="outline"
                className={cn('shrink-0 tabular-nums', c.stale ? SEVERITY_STYLE.rose.badge : SEVERITY_STYLE.ok.badge)}
              >
                {c.hoursAgo != null ? `${c.hoursAgo} ч назад` : '—'}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ChannelGapsCard({ channelGaps }: { channelGaps: DataQualityReport['channelGaps'] }) {
  const worst = Math.max(0, ...channelGaps.map((c) => c.daysWithoutSales));
  const style = worst > 0 ? (worst >= 3 ? SEVERITY_STYLE.rose : SEVERITY_STYLE.amber) : SEVERITY_STYLE.ok;
  return (
    <Card className={cn('flex flex-col', style.border, style.bg)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
          Дни без продаж по каналам
          <TooltipIcon text="Сколько последних дней подряд нет ни одной записи о продажах в источнике данных. Признак сбоя синхронизации или реального отсутствия продаж." />
        </CardTitle>
        {worst === 0 ? (
          <CheckCircle2 className={cn('size-5 shrink-0', style.text)} />
        ) : (
          <CalendarX className={cn('size-5 shrink-0', style.text)} />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        <span className={cn('text-2xl font-semibold tabular-nums tracking-tight', style.text)}>
          {formatInt(worst)}
        </span>
        <ul className="flex flex-col gap-1.5">
          {channelGaps.map((c) => (
            <li key={c.channel} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{c.channel}</span>
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 tabular-nums',
                  c.daysWithoutSales > 0 ? SEVERITY_STYLE.amber.badge : SEVERITY_STYLE.ok.badge,
                )}
              >
                {formatInt(c.daysWithoutSales)} дн.
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function DataQualityCards({ report }: { report: DataQualityReport }) {
  const totalIssues =
    report.checks.reduce((sum, c) => sum + c.count, 0) +
    report.cron.filter((c) => c.stale).length +
    report.channelGaps.filter((c) => c.daysWithoutSales > 0).length;

  if (totalIssues === 0) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 p-6">
          <CheckCircle2 className="size-8 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="flex flex-col">
            <span className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
              Все данные в порядке ✓
            </span>
            <span className="text-sm text-muted-foreground">
              Проверено {report.checks.length} категорий, ни одной проблемы не найдено.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {report.checks.map((check) => (
        <CheckCard key={check.key} check={check} />
      ))}
      <CronCard cron={report.cron} />
      <ChannelGapsCard channelGaps={report.channelGaps} />
    </div>
  );
}
