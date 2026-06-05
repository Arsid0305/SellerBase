'use client';

import { useState, type FormEvent } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { Goal, GoalInput, GoalMetric, GoalScope, GoalStatus } from '@/entities/goals';

const INPUT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const METRICS: { value: GoalMetric; label: string }[] = [
  { value: 'revenue', label: 'Выручка' },
  { value: 'margin', label: 'Маржа' },
  { value: 'units', label: 'Штуки' },
  { value: 'custom', label: 'Произвольная' },
];

const STATUSES: { value: GoalStatus; label: string }[] = [
  { value: 'active', label: 'Активная' },
  { value: 'achieved', label: 'Достигнута' },
  { value: 'paused', label: 'На паузе' },
  { value: 'cancelled', label: 'Отменена' },
];

const SCOPES: { value: GoalScope; label: string }[] = [
  { value: 'all', label: 'Весь бизнес' },
  { value: 'sku', label: 'SKU' },
  { value: 'category', label: 'Категория' },
];

type Props = {
  goal: Goal | null;
  onCancel: () => void;
  onSuccess: () => void;
};

export function GoalForm({ goal, onCancel, onSuccess }: Props) {
  const isEdit = goal !== null;
  const [title, setTitle] = useState(goal?.title ?? '');
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? 'revenue');
  const [targetValue, setTargetValue] = useState<string>(goal?.targetValue?.toString() ?? '');
  const [currentValue, setCurrentValue] = useState<string>(goal?.currentValue?.toString() ?? '');
  const [deadline, setDeadline] = useState<string>(goal?.deadline ?? '');
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? 'active');
  const [scope, setScope] = useState<GoalScope>(goal?.scope ?? 'all');
  const [scopeValue, setScopeValue] = useState<string>(goal?.scopeValue ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Укажите название цели');
      return;
    }
    const input: GoalInput = {
      title: title.trim(),
      metric,
      targetValue: targetValue === '' ? null : Number(targetValue),
      currentValue: currentValue === '' ? null : Number(currentValue),
      deadline: deadline === '' ? null : deadline,
      status,
      scope,
      scopeValue: scope === 'all' || scopeValue.trim() === '' ? null : scopeValue.trim(),
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/goals', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: goal!.id, patch: input } : input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Не удалось сохранить цель');
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>{isEdit ? 'Редактировать цель' : 'Новая цель'}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="col-span-full flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Название</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Например: Выручка Q2 2026"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Метрика</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)} className={INPUT_CLASS}>
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Статус</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)} className={INPUT_CLASS}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Целевое значение</span>
            <input
              type="number"
              step="0.01"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              className={INPUT_CLASS}
              placeholder="0"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Текущее значение</span>
            <input
              type="number"
              step="0.01"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              className={INPUT_CLASS}
              placeholder="0"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Дедлайн</span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Область</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as GoalScope)} className={INPUT_CLASS}>
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className={cn('col-span-full flex flex-col gap-1', scope === 'all' && 'opacity-50')}>
            <span className="text-xs font-medium text-muted-foreground">
              {scope === 'sku' ? 'Штрихкод SKU' : scope === 'category' ? 'Название категории' : 'Значение области'}
            </span>
            <input
              type="text"
              value={scopeValue}
              onChange={(e) => setScopeValue(e.target.value)}
              className={INPUT_CLASS}
              placeholder={scope === 'sku' ? '2000000000000' : scope === 'category' ? 'Косметика' : '—'}
              disabled={scope === 'all'}
            />
          </label>

          {error && (
            <div className="col-span-full rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Сохраняем…' : isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
