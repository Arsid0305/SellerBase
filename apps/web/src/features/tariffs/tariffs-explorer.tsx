'use client';

import { useState } from 'react';
import { TariffTabs } from './tariff-tabs';
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
      <TariffTabs active={active} onSelect={setActive} />
      {active === 'wb-box' && <WbBoxTariffsTable rows={boxRows} />}
      {active === 'wb-return' && <WbReturnTariffsTable rows={returnRows} />}
      {active === 'wb-dynamics' && (
        <WbDynamicsCard warehouses={boxRows} loadDynamics={loadBoxDynamicsAction} />
      )}
    </div>
  );
}
