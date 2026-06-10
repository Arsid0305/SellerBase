'use client';

import { useState } from 'react';
import { PersonalIndicesSection } from './personal-indices';
import { BaseLogisticsCard } from './base-logistics-card';
import { TariffTabs } from './tariff-tabs';
import { CommissionTable } from './commission-table';
import { LogisticsTable } from './logistics-table';
import { StorageTable } from './storage-table';
import { PenaltyTable } from './penalty-table';
import { DimensionTable } from './dimension-table';
import type { TariffTabKey } from './types';

export function TariffsExplorer() {
  const [active, setActive] = useState<TariffTabKey>('logistics');

  return (
    <div className="flex flex-col gap-6">
      <PersonalIndicesSection />
      <BaseLogisticsCard />
      <TariffTabs active={active} onSelect={setActive} />
      {active === 'commission' && <CommissionTable />}
      {active === 'logistics' && <LogisticsTable />}
      {active === 'storage' && <StorageTable />}
      {active === 'penalty' && <PenaltyTable />}
      {active === 'dimension' && <DimensionTable />}
    </div>
  );
}
