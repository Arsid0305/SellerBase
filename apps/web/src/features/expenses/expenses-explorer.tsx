'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { formatRub } from '@/shared/lib/format';

const CATEGORIES = ['Реклама вне WB', 'Упаковка', 'Зарплата', 'Прочее'] as const;
type Category = (typeof CATEGORIES)[number];

type Expense = {
  id: number;
  dt: string;
  category: Category;
  amount_rub: number;
  note: string | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

export function ExpensesExplorer({ initialRows }: { initialRows: Expense[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState<Expense[]>(initialRows);

  const [dt, setDt] = useState(todayIso());
  const [category, setCategory] = useState<Category>('Реклама вне WB');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const submit = useCallback(async () => {
    const amt = Number(amount.replace(',', '.').trim());
    if (!Number.isFinite(amt) || amt < 0) {
      setError('Укажите корректную сумму');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dt,
          category,
          amount_rub: amt,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? res.statusText));
        return;
      }
      setRows((prev) => [data, ...prev]);
      setAmount('');
      setNote('');
      startTransition(() => router.refresh());
    } catch {
      setError('Ошибка сети');
    } finally {
      setSaving(false);
    }
  }, [amount, category, dt, note, router]);

  const remove = useCallback(
    async (id: number) => {
      if (!confirm('Удалить расход?')) return;
      const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        startTransition(() => router.refresh());
      }
    },
    [router],
  );

  const totalThisMonth = rows
    .filter((r) => r.dt.slice(0, 7) === todayIso().slice(0, 7))
    .reduce((acc, r) => acc + Number(r.amount_rub), 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Добавить расход</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Дата</span>
              <input
                type="date"
                value={dt}
                onChange={(e) => setDt(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Категория</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Сумма ₽</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-xs text-muted-foreground">Комментарий</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="опционально"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
          </div>
          {error && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={submit} disabled={saving || !amount}>
              {saving ? 'Сохранение...' : 'Добавить'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">История расходов</CardTitle>
          <div className="text-xs text-muted-foreground">
            За текущий месяц: <span className="font-medium text-foreground">{formatRub(totalThisMonth)}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Расходов пока нет — добавь первый сверху.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-medium">Дата</th>
                  <th className="px-5 py-2 font-medium">Категория</th>
                  <th className="px-5 py-2 text-right font-medium">Сумма</th>
                  <th className="px-5 py-2 font-medium">Комментарий</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-accent/30">
                    <td className="px-5 py-2 tabular-nums">{fmtDate(r.dt)}</td>
                    <td className="px-5 py-2">{r.category}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatRub(Number(r.amount_rub))}</td>
                    <td className="px-5 py-2 text-muted-foreground">{r.note ?? '—'}</td>
                    <td className="px-5 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="text-muted-foreground hover:text-rose-600"
                        aria-label="Удалить"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
