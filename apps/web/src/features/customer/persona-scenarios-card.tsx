'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  LEVEL_LABEL,
  type Level3,
  type PersonaWithScenarios,
  type Scenario,
} from '@/entities/customer';

const LEVEL_TONE: Record<Level3, string> = {
  low: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  med: 'border-sky-200 bg-sky-50 text-sky-700',
  high: 'border-rose-200 bg-rose-50 text-rose-700',
};

function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-100">
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

type Props = {
  persona: PersonaWithScenarios;
  allScenarios: Scenario[];
};

export function PersonaScenariosCard({ persona, allScenarios }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [scenarioId, setScenarioId] = useState('');
  const [weight, setWeight] = useState('1.0');

  const linkedIds = new Set(persona.scenarios.map((s) => s.id));
  const available = allScenarios.filter((s) => !linkedIds.has(s.id));

  async function link() {
    if (!scenarioId) return;
    await fetch('/api/persona-scenarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        personaId: persona.id,
        scenarioId: Number(scenarioId),
        weight: Number(weight) || 1,
      }),
    });
    setScenarioId('');
    setWeight('1.0');
    setAdding(false);
    startTransition(() => router.refresh());
  }

  async function unlink(sid: number) {
    await fetch('/api/persona-scenarios', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ personaId: persona.id, scenarioId: sid }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-900">Сценарии покупки</div>
        {!adding && available.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)} disabled={pending}>
            <Plus className="h-3 w-3" /> Привязать
          </Button>
        )}
      </div>
      {adding && (
        <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">— выберите сценарий —</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-neutral-600">
              Вес (0–1):
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                type="number"
                step="0.1"
                min="0"
                max="1"
                className="w-20 rounded-md border border-neutral-200 px-2 py-1 text-sm"
              />
            </label>
            <Button size="sm" onClick={link} disabled={!scenarioId || pending}>
              Добавить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
              Отмена
            </Button>
          </div>
        </div>
      )}
      {persona.scenarios.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-400">
          Пока сценарии не привязаны
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {persona.scenarios.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white p-2"
            >
              <Link
                href={`/scenarios/${s.id}`}
                className="flex min-w-0 flex-1 flex-col truncate text-sm text-neutral-800 hover:text-neutral-950"
              >
                <span className="truncate font-medium">{s.title}</span>
                <span className="flex flex-wrap gap-1">
                  <Badge variant="outline" className={cn('text-[10px]', LEVEL_TONE[s.urgency])}>
                    Срочность: {LEVEL_LABEL[s.urgency]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn('text-[10px]', LEVEL_TONE[s.priceSensitivity])}
                  >
                    Цена: {LEVEL_LABEL[s.priceSensitivity]}
                  </Badge>
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-neutral-500">{s.weight.toFixed(2)}</span>
                <Progress value={s.weight} />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => unlink(s.id)}
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
  );
}
