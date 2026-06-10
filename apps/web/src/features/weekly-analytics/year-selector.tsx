'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/shared/ui/button';

export function YearSelector({ years, current }: { years: number[]; current: number }) {
  const router = useRouter();
  const params = useSearchParams();
  function setYear(y: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set('year', String(y));
    router.push(`?${sp.toString()}`);
  }
  return (
    <div className="flex items-center gap-1.5">
      {years.map((y) => (
        <Button
          key={y}
          size="sm"
          variant={y === current ? 'default' : 'outline'}
          onClick={() => setYear(y)}
        >
          {y}
        </Button>
      ))}
    </div>
  );
}
