'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { Goal, GoalMetric, GoalStatus } from '@/entities/goals';
import { GoalForm } from './goal-form';

const METRIC_LABEL: Record<GoalMetric, string> = {
  revenue: 'Выручка',
  margin: 'Маржа',
  units: 'Штуки',
  custom: 'Произвольная',
};

const STATUS_LABEL: Record<GoalStatus, string> = {
  active: 'Активная',
  achieved: 'Достигнута',
  paused: 'На паузе',
  cancelled: 'Отменена',
};

const STATUS_CLASS: Record<GoalStatus, string> = {
  active: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  achieved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  paused: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  cancelled: 'border-border bg-muted text-muted-foreground',
};

function formatDeadline(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y?.slice(2)}`;
}

function formatValue(metric: GoalMetric, v: number | null): string {
  if (v == null) return '—';
  if (metric === 'units') return new Intl.NumberFormat('ru-RU').format(v) + ' шт';
  if (metric === 'revenue' || metric === 'margin') {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v);
  }
  return new Intl.NumberFormat('ru-RU').format(v);
}

function progressColor(ratio: number): string {
  if (ratio > 1) return 'bg-emerald-500';
  if (ratio > 0.5) return 'bg-sky-500';
  return 'bg-amber-500';
}

export function GoalsList({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDelete(id: number) {
    if (!confirm('Удалить цель?')) return;
    const res = await fetch('/api/goals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      alert('Не удалось удалить цель');
      return;
    }
    startTransition(() => router.refresh());
  }

  function closeAndRefresh() {
    setEditing(null);
    setCreating(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus className="size-4" />
          Новая цель
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Целей пока нет. Создайте первую — задайте метрику, целевое значение и дедлайн.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => {
            const target = g.targetValue ?? 0;
            const current = g.currentValue ?? 0;
            const ratio = target > 0 ? current / target : 0;
            const pct = Math.max(0, Math.min(1.2, ratio));
            return (
              <Card key={g.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{g.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {METRIC_LABEL[g.metric]}
                      {g.scope !== 'all' && g.scopeValue ? ` · ${g.scope === 'sku' ? 'SKU' : 'Категория'}: ${g.scopeValue}` : ''}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0', STATUS_CLASS[g.status])}>
                    {STATUS_LABEL[g.status]}
                  </Badge>
                </div>

                <div>
                  <div className="mb-1 flex items-baseline justify-between text-sm tabular-nums">
                    <span className="font-medium">{formatValue(g.metric, g.currentValue)}</span>
                    <span className="text-xs text-muted-foreground">/ {formatValue(g.metric, g.targetValue)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', progressColor(ratio))}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>{target > 0 ? `${Math.round(ratio * 100)}%` : '—'}</span>
                    <span>до {formatDeadline(g.deadline)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(g)} disabled={isPending}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(g.id)} disabled={isPending}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg">
            <GoalForm
              goal={editing}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
              onSuccess={closeAndRefresh}
            />
          </div>
        </div>
      )}
    </div>
  );
}
