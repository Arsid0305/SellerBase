'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { AppNotification, NotificationSeverity } from '@/entities/notifications';

const POLL_MS = 60_000;

const dotColor: Record<NotificationSeverity, string> = {
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  const unread = items.filter((n) => !n.isRead).length;

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=15', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { items: AppNotification[] };
      setItems(data.items ?? []);
    } catch {
      // тихо игнорируем — колокольчик не критичен
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function markOne(n: AppNotification) {
    setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, isRead: true } : it)));
    void fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: n.id }),
    });
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function markAll() {
    setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Уведомления">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Уведомления</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Check className="size-3" />
              Прочитать все
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Нет уведомлений
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markOne(n)}
                className={cn(
                  'flex w-full items-start gap-2 border-b border-border/50 px-3 py-2 text-left transition-colors last:border-0 hover:bg-accent',
                  !n.isRead && 'bg-accent/40',
                )}
              >
                <span
                  className={cn('mt-1.5 size-2 shrink-0 rounded-full', dotColor[n.severity])}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn('truncate text-sm', !n.isRead && 'font-medium')}
                    >
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {n.body && (
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {n.body}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
