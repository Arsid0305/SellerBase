'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, Plus } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { Persona, ScenarioWithRelations } from '@/entities/customer';

export type ScenarioDetailSkuRef = { id: number; title: string; barcode: string | null };

type Props = {
  scenario: ScenarioWithRelations;
  allPersonas: Persona[];
  allSkus: ScenarioDetailSkuRef[];
};

function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ScenarioDetailCard({ scenario, allPersonas, allSkus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addingPersona, setAddingPersona] = useState(false);
  const [addingSku, setAddingSku] = useState(false);
  const [personaId, setPersonaId] = useState<string>('');
  const [personaWeight, setPersonaWeight] = useState('1.0');
  const [skuQuery, setSkuQuery] = useState('');
  const [skuId, setSkuId] = useState<number | null>(null);
  const [skuFit, setSkuFit] = useState('0.5');

  const linkedPersonaIds = new Set(scenario.personas.map((p) => p.id));
  const availablePersonas = allPersonas.filter((p) => !linkedPersonaIds.has(p.id));

  const skuMatches = useMemo(() => {
    const linkedSkuIds = new Set(scenario.skus.map((s) => s.id));
    const q = skuQuery.trim().toLowerCase();
    if (!q) return [];
    return allSkus
      .filter(
        (s) =>
          !linkedSkuIds.has(s.id) &&
          ((s.barcode ?? '').toLowerCase().includes(q) || s.title.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [skuQuery, allSkus, scenario.skus]);

  async function linkPersona() {
    if (!personaId) return;
    await fetch('/api/persona-scenarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        personaId: Number(personaId),
        scenarioId: scenario.id,
        weight: Number(personaWeight) || 1,
      }),
    });
    setPersonaId('');
    setPersonaWeight('1.0');
    setAddingPersona(false);
    startTransition(() => router.refresh());
  }

  async function unlinkPersona(pid: number) {
    await fetch('/api/persona-scenarios', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ personaId: pid, scenarioId: scenario.id }),
    });
    startTransition(() => router.refresh());
  }

  async function linkSku() {
    if (skuId == null) return;
    await fetch('/api/sku-scenarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        skuId,
        scenarioId: scenario.id,
        fitScore: Number(skuFit) || 0.5,
      }),
    });
    setSkuQuery('');
    setSkuId(null);
    setSkuFit('0.5');
    setAddingSku(false);
    startTransition(() => router.refresh());
  }

  async function unlinkSku(sid: number) {
    await fetch('/api/sku-scenarios', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skuId: sid, scenarioId: scenario.id }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-neutral-900">Покупательские персоны</div>
          {!addingPersona && availablePersonas.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAddingPersona(true)}
              disabled={pending}
            >
              <Plus className="h-3 w-3" /> Привязать
            </Button>
          )}
        </div>
        {addingPersona && (
          <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">— выберите персону —</option>
              {availablePersonas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-neutral-600">
                Вес (0–1):
                <input
                  value={personaWeight}
                  onChange={(e) => setPersonaWeight(e.target.value)}
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  className="w-20 rounded-md border border-neutral-200 px-2 py-1 text-sm"
                />
              </label>
              <Button size="sm" onClick={linkPersona} disabled={!personaId || pending}>
                Добавить
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAddingPersona(false)}
                disabled={pending}
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
        {scenario.personas.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-400">
            Пока никто не привязан
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {scenario.personas.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white p-2"
              >
                <Link
                  href={`/customers/${p.id}`}
                  className="flex-1 truncate text-sm text-neutral-800 hover:text-neutral-950"
                >
                  {p.name}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{p.weight.toFixed(2)}</span>
                  <Progress value={p.weight} />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => unlinkPersona(p.id)}
                    disabled={pending}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-neutral-900">Товары, закрывающие сценарий</div>
          {!addingSku && (
            <Button size="sm" variant="ghost" onClick={() => setAddingSku(true)} disabled={pending}>
              <Plus className="h-3 w-3" /> Привязать
            </Button>
          )}
        </div>
        {addingSku && (
          <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <div className="relative">
              <input
                value={skuQuery}
                onChange={(e) => {
                  setSkuQuery(e.target.value);
                  setSkuId(null);
                }}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                placeholder="Поиск по штрихкоду или названию"
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
                        <div className="font-mono text-xs text-neutral-500">{s.barcode}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-neutral-600">
                Fit score (0–1):
                <input
                  value={skuFit}
                  onChange={(e) => setSkuFit(e.target.value)}
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  className="w-20 rounded-md border border-neutral-200 px-2 py-1 text-sm"
                />
              </label>
              <Button size="sm" onClick={linkSku} disabled={skuId == null || pending}>
                Добавить
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingSku(false);
                  setSkuQuery('');
                  setSkuId(null);
                }}
                disabled={pending}
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
        {scenario.skus.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-400">
            Пока товары не привязаны
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {scenario.skus.map((s) => (
              <li
                key={s.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white p-2',
                )}
              >
                <Link
                  href={`/products/${encodeURIComponent(s.barcode ?? String(s.id))}`}
                  className="flex flex-1 flex-col truncate text-sm text-neutral-800 hover:text-neutral-950"
                >
                  <span className="truncate">{s.title}</span>
                  {s.barcode ? (
                    <span className="font-mono text-xs text-neutral-400">{s.barcode}</span>
                  ) : null}
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    {s.fitScore.toFixed(2)}
                  </Badge>
                  <Progress value={s.fitScore} />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => unlinkSku(s.id)}
                    disabled={pending}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
