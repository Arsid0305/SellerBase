'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CalendarRange, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';

type Range = { from: string; to: string };

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultA(): Range {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: iso(from), to: iso(to) };
}

function defaultB(a: Range): Range {
  const from = new Date(`${a.from}T00:00:00Z`);
  const to = new Date(`${a.to}T00:00:00Z`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));
  return { from: iso(prevFrom), to: iso(prevTo) };
}

export function DualPeriodPicker({
  initialA,
  initialB,
}: {
  initialA: Range;
  initialB: Range;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [fromA, setFromA] = useState(initialA.from);
  const [toA, setToA] = useState(initialA.to);
  const [fromB, setFromB] = useState(initialB.from);
  const [toB, setToB] = useState(initialB.to);

  const invalid = !fromA || !toA || !fromB || !toB || fromA > toA || fromB > toB;

  const apply = () => {
    const params = new URLSearchParams();
    params.set('from_a', fromA);
    params.set('to_a', toA);
    params.set('from_b', fromB);
    params.set('to_b', toB);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const reset = () => {
    const a = defaultA();
    const b = defaultB(a);
    setFromA(a.from);
    setToA(a.to);
    setFromB(b.from);
    setToB(b.to);
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:gap-6">
        <PeriodGroup
          label="Период A"
          accentClass="bg-sky-500"
          from={fromA}
          to={toA}
          onFrom={setFromA}
          onTo={setToA}
        />
        <PeriodGroup
          label="Период B"
          accentClass="bg-emerald-500"
          from={fromB}
          to={toB}
          onFrom={setFromB}
          onTo={setToB}
        />
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button size="sm" onClick={apply} disabled={invalid || pending} className="gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarRange className="size-4" />}
            Применить
          </Button>
          <Button size="sm" variant="outline" onClick={reset} disabled={pending} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            Сбросить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PeriodGroup({
  label,
  accentClass,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  accentClass: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className={`size-2 rounded-full ${accentClass}`} />
        {label}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>С</span>
          <input
            type="date"
            value={from}
            onChange={(e) => onFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs tabular-nums"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>По</span>
          <input
            type="date"
            value={to}
            onChange={(e) => onTo(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs tabular-nums"
          />
        </label>
      </div>
    </div>
  );
}
