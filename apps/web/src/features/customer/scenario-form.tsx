'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { LEVELS_3, LEVEL_LABEL, type Level3, type Scenario } from '@/entities/customer';

type Props = { initial?: Scenario; mode?: 'create' | 'edit' };

export function ScenarioForm({ initial, mode = 'create' }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === 'edit');
  const [submitting, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [trigger, setTrigger] = useState(initial?.trigger ?? '');
  const [urgency, setUrgency] = useState<Level3>(initial?.urgency ?? 'med');
  const [priceSensitivity, setPriceSensitivity] = useState<Level3>(
    initial?.priceSensitivity ?? 'med',
  );
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle('');
    setDescription('');
    setTrigger('');
    setUrgency('med');
    setPriceSensitivity('med');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Введите название сценария');
      return;
    }
    const body = {
      id: initial?.id,
      title: title.trim(),
      description: description.trim() || null,
      trigger: trigger.trim() || null,
      urgency,
      priceSensitivity,
    };
    const res = await fetch('/api/scenarios', {
      method: mode === 'edit' ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError('Не удалось сохранить');
      return;
    }
    if (mode === 'create') {
      reset();
      setOpen(false);
    }
    startTransition(() => router.refresh());
  }

  if (!open && mode === 'create') {
    return (
      <Button onClick={() => setOpen(true)} size="sm" className="gap-1">
        <Plus className="h-4 w-4" /> Новый сценарий
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-900">
          {mode === 'edit' ? 'Редактировать сценарий' : 'Новый сценарий'}
        </div>
        {mode === 'create' && (
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
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium text-neutral-700">Название *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="Например: Подарок маме на 8 марта"
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
            placeholder="Контекст: что покупатель ищет и почему"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium text-neutral-700">Триггер</span>
          <input
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="праздник / износ / апгрейд"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Срочность</span>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as Level3)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          >
            {LEVELS_3.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Чувствительность к цене</span>
          <select
            value={priceSensitivity}
            onChange={(e) => setPriceSensitivity(e.target.value as Level3)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          >
            {LEVELS_3.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="text-xs text-rose-600">{error}</div> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={submitting} className={cn(submitting && 'opacity-50')}>
          {mode === 'edit' ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
}
