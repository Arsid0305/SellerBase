'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { navGroups, navItems } from '@/shared/config/nav';
import { useSidenavStore } from '@/shared/stores/sidenav';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

export function Sidenav() {
  const pathname = usePathname();
  const open = useSidenavStore((s) => s.open);
  const close = useSidenavStore((s) => s.close);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm md:hidden"
          onClick={close}
        />
      )}

      <aside
        className={cn(
          'flex w-64 shrink-0 flex-col border-r border-border bg-card',
          // Desktop: static, always visible
          'md:static md:translate-x-0',
          // Mobile: fixed drawer
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 font-semibold tracking-tight">
          <span>SellerBase</span>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={close}
            aria-label="Закрыть меню"
          >
            <X className="size-4" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {navGroups.map((group) => {
            const items = navItems.filter((i) => i.group === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id} className="mb-4">
                <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </div>
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={close}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                            active
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          )}
                        >
                          <Icon className="size-4" />
                          <span className="flex-1 truncate">{item.title}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-[10px]">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
