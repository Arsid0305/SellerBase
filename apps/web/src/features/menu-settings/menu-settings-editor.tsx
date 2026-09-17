'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { navItems } from '@/shared/config/nav';
import { defaultEntries } from '@/entities/menu-layout/resolve';
import type { MenuEntry } from '@/entities/menu-layout/types';

type Row =
  | { kind: 'item'; href: string; hidden: boolean; title: string; badge?: string }
  | { kind: 'divider'; label: string };

function toRows(entries: MenuEntry[]): Row[] {
  const source = entries.length > 0 ? entries : defaultEntries();
  const byHref = new Map(navItems.map((i) => [i.href, i]));
  const used = new Set<string>();
  const rows: Row[] = [];
  for (const e of source) {
    if (e.kind === 'divider') {
      rows.push({ kind: 'divider', label: e.label ?? '' });
      continue;
    }
    const item = byHref.get(e.href);
    if (!item) continue;
    used.add(e.href);
    rows.push({ kind: 'item', href: e.href, hidden: e.hidden === true, title: item.title, badge: item.badge });
  }
  for (const i of navItems) {
    if (!used.has(i.href)) rows.push({ kind: 'item', href: i.href, hidden: false, title: i.title, badge: i.badge });
  }
  return rows;
}

function toEntries(rows: Row[]): MenuEntry[] {
  return rows.map((r) =>
    r.kind === 'divider'
      ? ({ kind: 'divider', label: r.label.trim() || undefined } as MenuEntry)
      : ({ kind: 'item', href: r.href, hidden: r.hidden } as MenuEntry),
  );
}

export function MenuSettingsEditor({ initialEntries }: { initialEntries: MenuEntry[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => toRows(initialEntries));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const hiddenCount = useMemo(
    () => rows.filter((r) => r.kind === 'item' && r.hidden).length,
    [rows],
  );

  function touched() {
    setSaved(false);
    setError(null);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return;
    setRows((prev) => {
      const next = [...prev];
      const [row] = next.splice(from, 1);
      if (row) next.splice(to, 0, row);
      return next;
    });
    touched();
  }

  function toggleHidden(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index && r.kind === 'item' ? { ...r, hidden: !r.hidden } : r)),
    );
    touched();
  }

  function addDivider() {
    setRows((prev) => [...prev, { kind: 'divider', label: '' }]);
    touched();
  }

  function removeDivider(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    touched();
  }

  function renameDivider(index: number, label: string) {
    setRows((prev) => prev.map((r, i) => (i === index && r.kind === 'divider' ? { ...r, label } : r)));
    touched();
  }

  function reset() {
    setRows(toRows([]));
    touched();
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: toEntries(rows) }),
      });
      if (!res.ok) throw new Error('save');
      setSaved(true);
      router.refresh();
    } catch {
      setError('Не удалось сохранить. Попробуй ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </Button>
        <Button variant="outline" onClick={addDivider} disabled={saving}>
          <Minus className="size-4" />
          Добавить черту
        </Button>
        <Button variant="outline" onClick={reset} disabled={saving}>
          Вернуть как было
        </Button>
        {saved && <span className="text-sm text-emerald-600">Сохранено</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
        <span className="ml-auto text-xs text-muted-foreground">
          {hiddenCount > 0 ? `Спрятано разделов: ${hiddenCount}` : 'Спрятанных разделов нет'}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Перетащи строку мышкой или двигай стрелками. Глазок прячет раздел из меню, сам раздел
        остаётся и открывается по прямой ссылке. Черта с подписью работает как заголовок группы,
        пустая - как простой разделитель.
      </p>

      <ul className="flex max-w-2xl flex-col gap-1">
        {rows.map((row, idx) => (
          <li
            key={row.kind === 'item' ? row.href : `d${idx}`}
            draggable
            onDragStart={() => {
              dragFrom.current = idx;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(idx);
            }}
            onDragLeave={() => setDragOver((v) => (v === idx ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              if (dragFrom.current != null) move(dragFrom.current, idx);
              dragFrom.current = null;
            }}
            onDragEnd={() => {
              dragFrom.current = null;
              setDragOver(null);
            }}
            className={[
              'flex items-center gap-2 rounded-md border bg-card px-2 py-1.5',
              dragOver === idx ? 'border-foreground/40' : 'border-border',
              row.kind === 'item' && row.hidden ? 'opacity-50' : '',
            ].join(' ')}
          >
            <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />

            {row.kind === 'divider' ? (
              <>
                <Minus className="size-4 shrink-0 text-muted-foreground" />
                <input
                  value={row.label}
                  onChange={(e) => renameDivider(idx, e.target.value)}
                  placeholder="Черта без подписи"
                  className="h-7 flex-1 rounded border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDivider(idx)}
                  aria-label="Убрать черту"
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 truncate text-sm">
                  {row.title}
                  {row.badge && (
                    <span className="ml-2 rounded bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-700 dark:text-fuchsia-300">
                      {row.badge}
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleHidden(idx)}
                  aria-label={row.hidden ? 'Показать раздел' : 'Спрятать раздел'}
                  title={row.hidden ? 'Показать раздел' : 'Спрятать раздел'}
                >
                  {row.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => move(idx, idx - 1)}
              disabled={idx === 0}
              aria-label="Выше"
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => move(idx, idx + 1)}
              disabled={idx === rows.length - 1}
              aria-label="Ниже"
            >
              <ArrowDown className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
