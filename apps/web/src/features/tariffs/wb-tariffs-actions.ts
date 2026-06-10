'use server';

import { fetchBoxTariffsDynamics } from '@/entities/wb-tariffs';
import type { WbTariffsBoxDynamicsPoint } from '@/entities/wb-tariffs';

export async function loadBoxDynamicsAction(
  warehouseName: string,
  days: number,
): Promise<WbTariffsBoxDynamicsPoint[]> {
  if (!warehouseName) return [];
  const safeDays = days === 90 ? 90 : 30;
  return fetchBoxTariffsDynamics(warehouseName, safeDays);
}
