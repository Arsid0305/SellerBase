'use client';

import { Suspense } from 'react';
import { Moon, Sun, Search, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/shared/ui/button';
import { PeriodComparePicker } from '@/shared/ui/domain/period-compare-picker';
import { MarketplaceFilter } from '@/shared/ui/domain/marketplace-filter';
import { useSidenavStore } from '@/shared/stores/sidenav';
import { NotificationBell } from './notification-bell';

function PeriodPickerFallback() {
  return (
    <Button variant="outline" size="sm" disabled>
      <span className="text-muted-foreground">Период…</span>
    </Button>
  );
}

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const toggleSidenav = useSidenavStore((s) => s.toggle);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={toggleSidenav}
        aria-label="Открыть меню"
      >
        <Menu className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="hidden text-muted-foreground md:inline-flex">
        <Search className="size-4" />
      </Button>
      <div className="flex-1" />
      <div className="hidden sm:block">
        <MarketplaceFilter />
      </div>
      <Suspense fallback={<PeriodPickerFallback />}>
        <PeriodComparePicker />
      </Suspense>
      <NotificationBell />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Тема"
      >
        <Sun className="size-4 dark:hidden" />
        <Moon className="hidden size-4 dark:block" />
      </Button>
    </header>
  );
}
