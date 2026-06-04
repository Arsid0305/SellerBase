'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

type ProductHit = { id: string | number; barcode: string; title: string; brand: string | null };
type GoalHit = { id: string | number; title: string };
type TaskHit = { id: string | number; title: string };

type SearchResponse = {
  products: ProductHit[];
  goals: GoalHit[];
  tasks: TaskHit[];
};

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        re.test(part) && part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-foreground dark:bg-yellow-500/40">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mac = useMemo(() => isMac(), []);

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    setDebounced('');
    setData(null);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = mac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mac, close]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    if (debounced.length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debounced)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json: SearchResponse) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setData({ products: [], goals: [], tasks: [] });
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [debounced, open]);

  const shortcut = mac ? '⌘K' : 'Ctrl+K';

  const hasAny =
    !!data && (data.products.length > 0 || data.goals.length > 0 || data.tasks.length > 0);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground gap-2"
        aria-label="Поиск"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Поиск</span>
        <kbd className="ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          {shortcut}
        </kbd>
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-background/70 backdrop-blur-sm sm:items-start sm:pt-[10vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Глобальный поиск"
        >
          <div
            className={cn(
              'flex w-full flex-col overflow-hidden border border-border bg-background shadow-xl',
              'h-full sm:h-auto sm:max-h-[70vh] sm:w-[640px] sm:rounded-lg',
            )}
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск товаров, целей, задач…"
                className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              <button
                type="button"
                onClick={close}
                className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
              >
                Esc
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {debounced.length < 2 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Введите минимум 2 символа
                </div>
              )}
              {debounced.length >= 2 && loading && !data && (
                <div className="flex items-center justify-center px-4 py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Поиск…
                </div>
              )}
              {debounced.length >= 2 && !loading && data && !hasAny && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Ничего не найдено
                </div>
              )}
              {data && hasAny && (
                <div className="flex flex-col gap-3">
                  {data.products.length > 0 && (
                    <Section title="Товары">
                      {data.products.map((p) => (
                        <ResultRow
                          key={`p-${p.id}`}
                          href={`/products/${encodeURIComponent(p.barcode)}`}
                          onClick={close}
                          title={p.title}
                          subtitle={[p.brand, p.barcode].filter(Boolean).join(' · ')}
                          query={debounced}
                        />
                      ))}
                    </Section>
                  )}
                  {data.goals.length > 0 && (
                    <Section title="Цели">
                      {data.goals.map((g) => (
                        <ResultRow
                          key={`g-${g.id}`}
                          href={`/goals#goal-${g.id}`}
                          onClick={close}
                          title={g.title}
                          query={debounced}
                        />
                      ))}
                    </Section>
                  )}
                  {data.tasks.length > 0 && (
                    <Section title="Задачи">
                      {data.tasks.map((t) => (
                        <ResultRow
                          key={`t-${t.id}`}
                          href={`/tasks#task-${t.id}`}
                          onClick={close}
                          title={t.title}
                          query={debounced}
                        />
                      ))}
                    </Section>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ResultRow({
  href,
  onClick,
  title,
  subtitle,
  query,
}: {
  href: string;
  onClick: () => void;
  title: string;
  subtitle?: string;
  query: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm hover:bg-accent"
    >
      <span className="truncate">
        <Highlight text={title} query={query} />
      </span>
      {subtitle && (
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      )}
    </Link>
  );
}
