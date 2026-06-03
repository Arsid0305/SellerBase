'use client';

import { useMemo, useState } from 'react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { turnoverColumns } from './turnover-columns';
import { TurnoverSegments } from './turnover-segments';
import type { TurnoverProduct, TurnoverSegment, TurnoverSegmentKey } from './types';

export function TurnoverExplorer({
  segments,
  products,
}: {
  segments: TurnoverSegment[];
  products: TurnoverProduct[];
}) {
  const [active, setActive] = useState<TurnoverSegmentKey>('all');
  const filtered = useMemo(
    () => (active === 'all' ? products : products.filter((p) => p.segment === active)),
    [active, products],
  );

  return (
    <div className="flex flex-col gap-6">
      <TurnoverSegments segments={segments} active={active} onSelect={setActive} />
      <DataTable
        data={filtered}
        columns={turnoverColumns}
        initialSort={[{ id: 'daysOfStock', desc: false }]}
        rowKey={(row) => row.id}
        empty="В этом сегменте пока нет товаров"
      />
    </div>
  );
}
