'use client';

import { Suspense } from 'react';
import { Moon, Sun, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/shared/ui/button';
import { PeriodComparePicker } from '@/shared/ui/domain/period-compare-picker';
import { MarketplaceFilter } from '@/shared/ui/domain/marketplace-filter';
import { MobileNavTrigger } from './sidenav';

function PeriodPickerFallback() {
  return (
    <Button variant="outline" size="sm" disabled>
      <span className="text-muted-foreground">Период…</span>
    </Button>
  );
}

export function Topbar() {
  const { theme, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 border-b border-border bg-background/80 px-2 backdrop-blur sm:gap-2 sm:px-4">
      <MobileNavTrigger />
      <Button variant="ghost" size="icon" className="hidden text-muted-foreground sm:inline-flex">
        <Search className="size-4" />
      </Button>
      <div className="flex-1" />
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <MarketplaceFilter />
        <Suspense fallback={<PeriodPickerFallback />}>
          <PeriodComparePicker />
        </Suspense>
      </div>
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
