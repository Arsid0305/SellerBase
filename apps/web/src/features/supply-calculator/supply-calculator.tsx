'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, Save } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatInt } from '@/shared/lib/format';

type Row = {
  sku_id: number;
  my_article: string | null;
  wb_article: number | null;
  barcode: string | null;
  units_per_day: number;
  total_stock: number;
  days_left: number | null;
  units_to_order: number;
};

export function SupplyCalculator() {
  const router = useRouter();
  const [lead, setLead] = useState(60);
  const [safety, setSafety] = useState(14);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  const [planName, setPlanName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/supplies/calculator?lead=${lead}&safety=${safety}`);
        if (res.ok) {
          const j = await res.json();
          if (!cancelled) {
            setRows((j.rows ?? []).map((r: Row) => ({
              ...r,
              units_per_day: Number(r.units_per_day),
              total_stock: Number(r.total_stock),
              days_left: r.days_left == null ? null : Number(r.days_left),
              units_to_order: Number(r.units_to_order),
            })));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const t = setTimeout(load, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [lead, safety]);

  const filtered = rows.filter((r) => (overrides[r.sku_id] ?? r.units_to_order) > 0);
  const totals = useMemo(() => {
    let items = 0;
    let units = 0;
    for (const r of filtered) {
      const qty = overrides[r.sku_id] ?? r.units_to_order;
      if (qty > 0) { items += 1; units += qty; }
    }
    return { items, units };
  }, [filtered, overrides]);

  async function savePlan() {
    if (!planName.trim()) {
      setError('Введи название поставки');
      return;
    }
    if (totals.items === 0) {
      setError('Нет позиций для поставки');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const items = filtered.map((r) => ({
        sku_id: r.sku_id,
        qty: overrides[r.sku_id] ?? r.units_to_order,
      }));
      const res = await fetch('/api/supplies/plan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: planName, notes: `lead=${lead}, safety=${safety}`, items }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setSaved(j.plan_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ошибка');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 rounded-md border bg-card p-4 sm:grid-cols-2">
        <SliderControl label="Lead time (дни)" hint="Время от заказа до попадания на WB склад" value={lead} min={0} max={180} step={1} onChange={setLead} />
        <SliderControl label="Safety stock (дни)" hint="Страховой запас на случай задержек / всплеска" value={safety} min={0} max={60} step={1} onChange={setSafety} />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Артикул</th>
              <th className="px-3 py-2 text-left">Название / ВБ</th>
              <th className="px-3 py-2 text-right">Прод./день</th>
              <th className="px-3 py-2 text-right">Остаток</th>
              <th className="px-3 py-2 text-right">Хватит, дн</th>
              <th className="px-3 py-2 text-right">Рекомендуем</th>
              <th className="px-3 py-2 text-right w-24">Заказать</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">Нет данных.</td></tr>
            ) : rows.map((r) => {
              const dayColor = r.days_left == null ? 'text-muted-foreground' : r.days_left < 14 ? 'text-rose-600' : r.days_left < 30 ? 'text-amber-600' : 'text-emerald-600';
              const rec = r.units_to_order;
              const val = overrides[r.sku_id] ?? rec;
              return (
                <tr key={r.sku_id} className={cn('border-t', val > 0 && 'bg-amber-50/30 dark:bg-amber-950/10')}>
                  <td className="px-3 py-2 font-medium">{r.my_article ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.wb_article ?? '—'} · {r.barcode ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.units_per_day.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatInt(r.total_stock)}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', dayColor)}>{r.days_left == null ? '∞' : r.days_left.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{rec > 0 ? formatInt(rec) : '—'}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setOverrides((o) => ({ ...o, [r.sku_id]: Number.isFinite(n) && n >= 0 ? Math.round(n) : 0 }));
                      }}
                      className="w-20 rounded border border-border bg-background px-2 py-1 text-right text-sm tabular-nums"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {saved ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="mr-1 inline h-4 w-4" /> План поставки #{saved} сохранён.
          <button type="button" onClick={() => router.push('/supplies')} className="ml-3 underline">Открыть «Поставки»</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-4">
          <input
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="Название плана (например: Июль 2026 — WB Электросталь)"
            className="min-w-[280px] flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div>SKU: <b className="text-foreground tabular-nums">{totals.items}</b></div>
            <div>Единиц: <b className="text-foreground tabular-nums">{formatInt(totals.units)}</b></div>
          </div>
          <button
            type="button"
            onClick={savePlan}
            disabled={saving || totals.items === 0}
            className="inline-flex items-center gap-1 rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить план
          </button>
          {error && <span className="w-full text-xs text-rose-600">{error}</span>}
        </div>
      )}
    </div>
  );
}

function SliderControl({ label, hint, value, min, max, step, onChange }: { label: string; hint: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-16 rounded border border-border bg-background px-2 py-0.5 text-right text-sm tabular-nums"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}
