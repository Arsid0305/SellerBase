'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';

type Latest = {
  week_start: string;
  localization_index: number | null;
  sales_distribution_index: number | null;
  fbo_reliability_pct: number | null;
  note: string | null;
} | null;

function isoLastMonday(): string {
  const d = new Date();
  const dow = d.getUTCDay();
  const shift = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

export function PersonalIndicesForm({ latest }: { latest: Latest }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState(isoLastMonday());
  const [loc, setLoc] = useState(latest?.localization_index != null ? String(latest.localization_index) : '');
  const [dist, setDist] = useState(latest?.sales_distribution_index != null ? String(latest.sales_distribution_index) : '');
  const [rel, setRel] = useState(latest?.fbo_reliability_pct != null ? String(latest.fbo_reliability_pct) : '');
  const [note, setNote] = useState(latest?.note ?? '');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/tariffs/personal-indices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start: weekStart,
          localization_index: loc,
          sales_distribution_index: dist,
          fbo_reliability_pct: rel,
          note,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ошибка');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-border bg-card px-4 py-3">
      <div className="mb-2 text-sm font-medium">Внести значения из ЛК WB</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Неделя (пн)</span>
          <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-sm" required />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Индекс локализации</span>
          <input type="number" step="0.01" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="1.00" className="rounded border border-border bg-background px-2 py-1 text-sm tabular-nums" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Индекс распред.</span>
          <input type="number" step="0.01" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="1.00" className="rounded border border-border bg-background px-2 py-1 text-sm tabular-nums" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Надёжность FBO %</span>
          <input type="number" step="0.1" value={rel} onChange={(e) => setRel(e.target.value)} placeholder="90.0" className="rounded border border-border bg-background px-2 py-1 text-sm tabular-nums" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Заметка</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="—" className="rounded border border-border bg-background px-2 py-1 text-sm" />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={saving || pending} className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
          {saving || pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Сохранить
        </button>
        {saved && <span className="text-xs text-emerald-600">✓ сохранено</span>}
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
    </form>
  );
}
