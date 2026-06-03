'use client';

import { Moon, Sun, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/shared/ui/button';
import { PeriodComparePicker } from '@/shared/ui/domain/period-compare-picker';
import { MarketplaceFilter } from '@/shared/ui/domain/marketplace-filter';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="text-muted-foreground">
        <Search className="size-4" />
      </Button>
      <div className="flex-1" />
      <MarketplaceFilter />
      <PeriodComparePicker />
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
