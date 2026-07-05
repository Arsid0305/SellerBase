'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, Check, X, Pencil } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatRub } from '@/shared/lib/format';

type Props = {
  nmId: number;
  currentPrice: number | null;
  discountPct: number | null;
  history: { date: string; price: number }[];
  onSaved?: () => void;
};

export function PriceEditCell({ nmId, currentPrice, discountPct, history, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentPrice != null ? String(Math.round(currentPrice)) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) {
      setError('цена > 0');
      return;
    }
    if (currentPrice != null && Math.round(price) === Math.round(currentPrice)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/promo/set-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [{ nmID: nmId, price: Math.round(price), discount: Math.round(discountPct ?? 0) }] }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setEditing(false);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ошибка');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group flex items-center gap-1 tabular-nums hover:text-primary"
          title="Изменить цену"
        >
          {currentPrice == null ? '—' : formatRub(currentPrice)}
          <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70" />
        </button>
        <PriceSparkline history={history} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') { setEditing(false); setValue(currentPrice != null ? String(Math.round(currentPrice)) : ''); }
          }}
          disabled={saving}
          className="w-20 rounded border border-border bg-background px-1.5 py-0.5 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
          title="Сохранить"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setValue(currentPrice != null ? String(Math.round(currentPrice)) : ''); setError(null); }}
          disabled={saving}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
          title="Отмена"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {error && <div className="max-w-[140px] text-right text-[10px] text-rose-600">{error}</div>}
    </div>
  );
}

function PriceSparkline({ history }: { history: { date: string; price: number }[] }) {
  if (history.length < 2) return <div className="h-4" />;
  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 50;
  const h = 12;
  const step = w / (history.length - 1);
  const points = history
    .map((p, i) => `${(i * step).toFixed(1)},${(h - ((p.price - min) / range) * h).toFixed(1)}`)
    .join(' ');
  const last = prices[prices.length - 1] ?? 0;
  const first = prices[0] ?? 0;
  const trendColor = last > first ? '#10b981' : last < first ? '#f43f5e' : '#94a3b8';
  return (
    <svg
      width={w}
      height={h}
      className="opacity-70"
      aria-label={`${history.length} точек, min ${min}₽ / max ${max}₽`}
    >
      <title>{`${history.length} точек · min ${min}₽ · max ${max}₽`}</title>
      <polyline points={points} fill="none" stroke={trendColor} strokeWidth="1" />
    </svg>
  );
}
