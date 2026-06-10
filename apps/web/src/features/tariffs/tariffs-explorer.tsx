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
import { WbBoxTariffsTable } from './wb-box-table';
import { WbReturnTariffsTable } from './wb-return-table';
import { WbDynamicsCard } from './wb-dynamics-card';
import { loadBoxDynamicsAction } from './wb-tariffs-actions';
import type { TariffTabKey } from './types';
import type { WbTariffsBox, WbTariffsReturn } from '@/entities/wb-tariffs';

export function TariffsExplorer({
  boxRows,
  returnRows,
}: {
  boxRows: WbTariffsBox[];
  returnRows: WbTariffsReturn[];
}) {
  const [active, setActive] = useState<TariffTabKey>('wb-box');

  return (
    <div className="flex flex-col gap-6">
      <PersonalIndicesSection />
      <p className="text-xs text-muted-foreground">
        · Индексы локализации и распределения продаж вводятся вручную, обновляются раз в неделю.
      </p>
      <BaseLogisticsCard />
      <TariffTabs active={active} onSelect={setActive} />
      {active === 'wb-box' && <WbBoxTariffsTable rows={boxRows} />}
      {active === 'wb-return' && <WbReturnTariffsTable rows={returnRows} />}
      {active === 'wb-dynamics' && (
        <WbDynamicsCard warehouses={boxRows} loadDynamics={loadBoxDynamicsAction} />
      )}
      {active === 'commission' && <CommissionTable />}
      {active === 'logistics' && <LogisticsTable />}
      {active === 'storage' && <StorageTable />}
      {active === 'penalty' && <PenaltyTable />}
      {active === 'dimension' && <DimensionTable />}
    </div>
  );
}
