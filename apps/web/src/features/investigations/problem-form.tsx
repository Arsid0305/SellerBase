'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  PROBLEM_SEVERITIES,
  PROBLEM_SEVERITY_LABEL,
  type ProblemSeverity,
} from '@/entities/investigations';

export type ProblemFormSku = { id: number; title: string; barcode?: string | null };

type Props = {
  skus?: ProblemFormSku[];
};

export function ProblemForm({ skus = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<ProblemSeverity>('med');
  const [scopeCategory, setScopeCategory] = useState('');
  const [skuQuery, setSkuQuery] = useState('');
  const [skuId, setSkuId] = useState<number | null>(null);
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
    setSeverity('med');
    setScopeCategory('');
    setSkuQuery('');
    setSkuId(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Введите название проблемы');
      return;
    }
    const res = await fetch('/api/problems', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        severity,
        scopeSkuId: skuId,
        scopeCategory: scopeCategory.trim() || null,
      }),
    });
    if (!res.ok) {
      setError('Не удалось создать проблему');
      return;
    }
    reset();
    setOpen(false);
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" className="gap-1">
        <Plus className="h-4 w-4" /> Новая проблема
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-900">Новая проблема</div>
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
            placeholder="Что не так"
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
            placeholder="Детали проблемы"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Критичность</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as ProblemSeverity)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          >
            {PROBLEM_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {PROBLEM_SEVERITY_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Категория (опц.)</span>
          <input
            value={scopeCategory}
            onChange={(e) => setScopeCategory(e.target.value)}
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="Напр.: одежда"
          />
        </label>

        <label className="relative flex flex-col gap-1 md:col-span-2">
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
