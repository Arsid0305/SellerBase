'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  PROBLEM_STATUSES,
  PROBLEM_SEVERITY_LABEL,
  PROBLEM_STATUS_LABEL,
  PROBLEM_SOURCE_LABEL,
  type Problem,
  type ProblemSeverity,
  type ProblemStatus,
} from '@/entities/investigations';

type Props = {
  problems: Problem[];
};

const SEVERITY_STYLES: Record<ProblemSeverity, string> = {
  low: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  med: 'bg-sky-50 text-sky-700 border-sky-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_STYLES: Record<ProblemStatus, string> = {
  open: 'bg-sky-50 text-sky-700 border-sky-200',
  investigating: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ProblemsList({ problems }: Props) {
  const [filter, setFilter] = useState<ProblemStatus | 'all'>('all');

  const counts = useMemo(() => {
    const map: Record<ProblemStatus | 'all', number> = {
      all: problems.length,
      open: 0,
      investigating: 0,
      resolved: 0,
      closed: 0,
    };
    for (const p of problems) map[p.status] += 1;
    return map;
  }, [problems]);

  const filtered = filter === 'all' ? problems : problems.filter((p) => p.status === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            filter === 'all'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
          )}
        >
          Все ({counts.all})
        </button>
        {PROBLEM_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filter === s
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
            )}
          >
            {PROBLEM_STATUS_LABEL[s]} ({counts[s]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
          Нет проблем
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold leading-snug text-neutral-900">
                    {p.title}
                  </div>
                  {p.description ? (
                    <p className="text-xs leading-relaxed text-neutral-600">{p.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline" className={SEVERITY_STYLES[p.severity]}>
                    {PROBLEM_SEVERITY_LABEL[p.severity]}
                  </Badge>
                  <Badge variant="outline" className={STATUS_STYLES[p.status]}>
                    {PROBLEM_STATUS_LABEL[p.status]}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                <div className="flex flex-wrap items-center gap-3">
                  <span>{PROBLEM_SOURCE_LABEL[p.source]}</span>
                  <span>детектирована {formatDate(p.detectedAt)}</span>
                  {p.scopeCategory ? <span>категория: {p.scopeCategory}</span> : null}
                  {p.scopeSkuId != null ? <span>SKU #{p.scopeSkuId}</span> : null}
                </div>
                <Link href={`/problems/${p.id}`}>
                  <Button size="sm" variant="outline" className="gap-1">
                    <Search className="h-3 w-3" /> Исследовать
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
