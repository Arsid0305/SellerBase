'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Play, Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_PRIORITY_LABEL,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from '@/entities/tasks';

export type TasksListGoalRef = { id: number; title: string };
export type TasksListSkuRef = { id: number; title: string };

type Props = {
  tasks: Task[];
  goals?: TasksListGoalRef[];
  skus?: TasksListSkuRef[];
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  med: 'bg-sky-50 text-sky-700 border-sky-200',
  high: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_COLUMN_STYLES: Record<TaskStatus, string> = {
  todo: 'border-neutral-200',
  in_progress: 'border-sky-200',
  done: 'border-emerald-200',
  cancelled: 'border-neutral-200 opacity-70',
};

function dueDateTone(dueDate: string | null): 'overdue' | 'today' | 'future' | 'none' {
  if (!dueDate) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  if (due.getTime() < today.getTime()) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  return 'future';
}

const DUE_TONE_CLASSES: Record<'overdue' | 'today' | 'future' | 'none', string> = {
  overdue: 'text-rose-600',
  today: 'text-amber-600',
  future: 'text-neutral-500',
  none: 'text-neutral-400',
};

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '';
  const d = new Date(`${dueDate}T00:00:00`);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

export function TasksList({ tasks, goals = [], skus = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');

  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g.title])), [goals]);
  const skuMap = useMemo(() => new Map(skus.map((s) => [s.id, s.title])), [skus]);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const t of tasks) map[t.status]?.push(t);
    return map;
  }, [tasks]);

  async function patch(id: number, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!confirm('Удалить задачу?')) return;
    setBusyId(id);
    try {
      await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  function Card({ t }: { t: Task }) {
    const goalTitle = t.goalId != null ? goalMap.get(t.goalId) : null;
    const skuTitle = t.skuId != null ? skuMap.get(t.skuId) : null;
    const tone = dueDateTone(t.dueDate);
    const isBusy = busyId === t.id || pending;
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium leading-snug text-neutral-900">{t.title}</div>
          <Badge variant="outline" className={cn('shrink-0', PRIORITY_STYLES[t.priority])}>
            {TASK_PRIORITY_LABEL[t.priority]}
          </Badge>
        </div>
        {t.description ? (
          <p className="text-xs leading-relaxed text-neutral-600">{t.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {goalTitle ? (
            <span className="text-neutral-500">
              → Цель: <span className="text-neutral-700">{goalTitle}</span>
            </span>
          ) : null}
          {skuTitle ? (
            <span className="text-neutral-500">
              → SKU: <span className="text-neutral-700">{skuTitle}</span>
            </span>
          ) : null}
          {t.dueDate ? (
            <span className={DUE_TONE_CLASSES[tone]}>до {formatDueDate(t.dueDate)}</span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-1">
          {t.status === 'todo' && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => patch(t.id, { status: 'in_progress' })}
            >
              <Play className="h-3 w-3" /> В работе
            </Button>
          )}
          {t.status === 'in_progress' && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => patch(t.id, { status: 'done' })}
            >
              <Check className="h-3 w-3" /> Готово
            </Button>
          )}
          {(t.status === 'done' || t.status === 'cancelled') && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => patch(t.id, { status: 'todo' })}
            >
              <RotateCcw className="h-3 w-3" /> Вернуть
            </Button>
          )}
          {t.status !== 'cancelled' && t.status !== 'done' && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => patch(t.id, { status: 'cancelled' })}
            >
              <X className="h-3 w-3" /> Отмена
            </Button>
          )}
          <div className="ml-auto">
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => remove(t.id)}
              className="text-rose-600 hover:text-rose-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile: filter chips + flat list */}
      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            filter === 'all'
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
          )}
        >
          Все ({tasks.length})
        </button>
        {TASK_STATUSES.map((s) => (
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
            {TASK_STATUS_LABEL[s]} ({grouped[s].length})
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 lg:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            Нет задач
          </div>
        ) : (
          filtered.map((t) => <Card key={t.id} t={t} />)
        )}
      </div>

      {/* Desktop: Kanban 4 columns */}
      <div className="hidden grid-cols-4 gap-4 lg:grid">
        {TASK_STATUSES.map((s) => (
          <div
            key={s}
            className={cn(
              'flex min-h-[200px] flex-col gap-3 rounded-lg border-t-2 bg-neutral-50/50 p-3',
              STATUS_COLUMN_STYLES[s],
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                {TASK_STATUS_LABEL[s]}
              </div>
              <div className="text-xs text-neutral-400">{grouped[s].length}</div>
            </div>
            <div className="flex flex-col gap-2">
              {grouped[s].length === 0 ? (
                <div className="rounded-md border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-400">
                  Пусто
                </div>
              ) : (
                grouped[s].map((t) => <Card key={t.id} t={t} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
