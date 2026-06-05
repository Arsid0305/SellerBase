'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUS_LABEL,
  TASK_PRIORITY_LABEL,
  type TaskStatus,
  type TaskPriority,
} from '@/entities/tasks';

export type TaskFormGoal = { id: number; title: string };
export type TaskFormSku = { id: number; title: string; barcode?: string | null };

type Props = {
  goals?: TaskFormGoal[];
  skus?: TaskFormSku[];
};

export function TaskForm({ goals = [], skus = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalId, setGoalId] = useState<string>('');
  const [skuQuery, setSkuQuery] = useState('');
  const [skuId, setSkuId] = useState<number | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('med');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const skuMatches = useMemo(() => {
    const q = skuQuery.trim().toLowerCase();
    if (!q) return [];
    return skus
      .filter(
        (s) =>
          (s.barcode ?? '').toLowerCase().includes(q) ||
          (s.title ?? '').toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [skuQuery, skus]);

  function reset() {
    setTitle('');
    setDescription('');
    setGoalId('');
    setSkuQuery('');
    setSkuId(null);
    setPriority('med');
    setStatus('todo');
    setDueDate('');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Введите название задачи');
      return;
    }
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        goalId: goalId ? Number(goalId) : null,
        skuId,
        priority,
        status,
        dueDate: dueDate || null,
      }),
    });
    if (!res.ok) {
      setError('Не удалось создать задачу');
      return;
    }
    reset();
    setOpen(false);
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" className="gap-1">
        <Plus className="h-4 w-4" /> Новая задача
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-900">Новая задача</div>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          Отмена
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium text-neutral-700">Название *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="Что нужно сделать"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium text-neutral-700">Описание</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="Детали (опционально)"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Цель</span>
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          >
            <option value="">— без цели —</option>
            {goals.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.title}
              </option>
            ))}
          </select>
        </label>

        <label className="relative flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">
            SKU{skuId != null ? ' (выбран)' : ''}
          </span>
          <input
            value={skuQuery}
            onChange={(e) => {
              setSkuQuery(e.target.value);
              setSkuId(null);
            }}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="Поиск по barcode или названию"
          />
          {skuMatches.length > 0 && skuId == null && (
            <div className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-neutral-200 bg-white shadow-md">
              {skuMatches.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setSkuId(s.id);
                    setSkuQuery(s.title);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                >
                  <div className="font-medium">{s.title}</div>
                  {s.barcode ? (
                    <div className="text-xs text-neutral-500">{s.barcode}</div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Приоритет</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Статус</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Срок</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
        </label>
      </div>

      {error ? <div className="text-xs text-rose-600">{error}</div> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={submitting} className={cn(submitting && 'opacity-50')}>
          Создать
        </Button>
      </div>
    </form>
  );
}
