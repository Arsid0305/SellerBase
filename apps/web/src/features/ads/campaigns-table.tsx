'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import type { CsvColumn } from '@/shared/lib/csv';
import { cn } from '@/shared/lib/utils';
import { campaignsColumns } from './campaigns-columns';
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_TYPE_LABEL, type AdCampaign, type CampaignStatus } from './types';

const STATUS_CHIPS: { key: CampaignStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активные' },
  { key: 'paused', label: 'Пауза' },
  { key: 'archived', label: 'Архив' },
];

const CSV_COLUMNS: CsvColumn<AdCampaign>[] = [
  { key: 'name', label: 'Кампания' },
  { key: 'type', label: 'Тип', format: (r) => CAMPAIGN_TYPE_LABEL[r.type] },
  { key: 'marketplace', label: 'Канал' },
  { key: 'status', label: 'Статус', format: (r) => CAMPAIGN_STATUS_LABEL[r.status] },
  { key: 'dailyBudget', label: 'Бюджет/день ₽' },
  { key: 'cpc', label: 'CPC ₽' },
  { key: 'clicks', label: 'Клики' },
  { key: 'orders', label: 'Заказы' },
  { key: 'conversionRate', label: 'CR %' },
  { key: 'spend', label: 'Расход ₽' },
  { key: 'revenue', label: 'Выручка ₽' },
  { key: 'roas', label: 'ROAS ×' },
];

export function CampaignsTable({ campaigns }: { campaigns: AdCampaign[] }) {
  const [status, setStatus] = useState<CampaignStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      campaigns
        .filter((c) => status === 'all' || c.status === status)
        .filter((c) => (search ? c.name.toLowerCase().includes(search.toLowerCase()) : true)),
    [campaigns, status, search],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Активные кампании</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            {filtered.length} из {campaigns.length}
          </span>
          <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="ad-campaigns" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию кампании…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_CHIPS.map((c) => {
              const active = status === c.key;
              return (
                <Button
                  key={c.key}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className={cn(!active && 'text-muted-foreground')}
                  onClick={() => setStatus(c.key)}
                >
                  {c.label}
                </Button>
              );
            })}
          </div>
        </div>

        <DataTable
          data={filtered}
          columns={campaignsColumns}
          initialSort={[{ id: 'spend', desc: true }]}
          rowKey={(row) => row.id}
          empty="Кампаний по выбранному фильтру нет."
        />
      </CardContent>
    </Card>
  );
}
