'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/utils';

type Tab = 'plans' | 'fbw';

export function SuppliesTabs({ plansSlot, fbwSlot }: { plansSlot: React.ReactNode; fbwSlot: React.ReactNode }) {
  const [active, setActive] = useState<Tab>('plans');
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b">
        <TabButton active={active === 'plans'} onClick={() => setActive('plans')}>Планы поставок (Китай)</TabButton>
        <TabButton active={active === 'fbw'} onClick={() => setActive('fbw')}>FBW-поставки (WB)</TabButton>
      </div>
      <div>{active === 'plans' ? plansSlot : fbwSlot}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
        active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
