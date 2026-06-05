'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  GENDERS,
  INCOME_LEVELS,
  GENDER_LABEL,
  INCOME_LABEL,
  type Gender,
  type IncomeLevel,
  type Persona,
} from '@/entities/customer';

type Props = { initial?: Persona; mode?: 'create' | 'edit' };

export function PersonaForm({ initial, mode = 'create' }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === 'edit');
  const [submitting, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [ageMin, setAgeMin] = useState<string>(initial?.ageMin?.toString() ?? '');
  const [ageMax, setAgeMax] = useState<string>(initial?.ageMax?.toString() ?? '');
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '');
  const [incomeLevel, setIncomeLevel] = useState<IncomeLevel | ''>(initial?.incomeLevel ?? '');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setDescription('');
    setAgeMin('');
    setAgeMax('');
    setGender('');
    setIncomeLevel('');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Введите название персоны');
      return;
    }
    const body = {
      id: initial?.id,
      name: name.trim(),
      description: description.trim() || null,
      ageMin: ageMin ? Number(ageMin) : null,
      ageMax: ageMax ? Number(ageMax) : null,
      gender: gender || null,
      incomeLevel: incomeLevel || null,
    };
    const res = await fetch('/api/personas', {
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
        <Plus className="h-4 w-4" /> Новая персона
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
          {mode === 'edit' ? 'Редактировать персону' : 'Новая персона'}
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="Например: Мама малыша 1–3 года"
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
            placeholder="Кто эта персона, чем живёт"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Возраст от</span>
          <input
            type="number"
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="18"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Возраст до</span>
          <input
            type="number"
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="35"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Пол</span>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | '')}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          >
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABEL[g]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Уровень дохода</span>
          <select
            value={incomeLevel}
            onChange={(e) => setIncomeLevel(e.target.value as IncomeLevel | '')}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          >
            <option value="">—</option>
            {INCOME_LEVELS.map((l) => (
              <option key={l} value={l}>
                {INCOME_LABEL[l]}
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
