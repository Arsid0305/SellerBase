'use client';

import { useMemo, useState } from 'react';
import { Truck } from 'lucide-react';
import { CategoryCard } from '@/shared/ui/domain/category-card';
import { formatRub } from '@/shared/lib/format';
import type { WbTariffsBox } from '@/entities/wb-tariffs';

function calcDeliveryCost(volumeL: number, base: number, liter: number, coef: number): number {
  if (volumeL <= 0) return 0;
  if (volumeL < 1) return volumeL * liter * coef;
  return (base + (volumeL - 1) * liter) * coef;
}

export function ProductLogisticsForecastCard({
  warehouses,
  initialVolumeL = 0.5,
}: {
  warehouses: WbTariffsBox[];
  initialVolumeL?: number;
}) {
  const [warehouseName, setWarehouseName] = useState<string>(
    warehouses[0]?.warehouseName ?? '',
  );
  const [volumeL, setVolumeL] = useState<number>(initialVolumeL);
  const [days, setDays] = useState<number>(30);
  const [il, setIl] = useState<number>(1.0);
  const [irp, setIrp] = useState<number>(0);

  const selected = useMemo(
    () => warehouses.find((w) => w.warehouseName === warehouseName) ?? null,
    [warehouses, warehouseName],
  );

  const perUnit = selected
    ? calcDeliveryCost(volumeL, selected.boxDeliveryBase, selected.boxDeliveryLiter, selected.warehouseCoef) * il +
      irp
    : 0;
  const totalForPeriod = perUnit * days;

  if (warehouses.length === 0) {
    return (
      <CategoryCard title="Прогноз логистики" tone="sky" icon={Truck}>
        <p className="text-sm text-muted-foreground">
          Тарифы складов ещё не загружены. После первого запуска fetch-wb-tariffs прогноз станет доступен.
        </p>
      </CategoryCard>
    );
  }

  return (
    <CategoryCard title="Прогноз логистики" tone="sky" icon={Truck}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Склад</span>
            <select
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              value={warehouseName}
              onChange={(e) => setWarehouseName(e.target.value)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.warehouseName}>
                  {w.warehouseName} — коэф {w.warehouseCoef.toFixed(2).replace(/\.?0+$/, '')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Объём, л</span>
            <input
              type="number"
              step="0.1"
              min="0"
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm tabular-nums"
              value={volumeL}
              onChange={(e) => setVolumeL(parseFloat(e.target.value) || 0)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">ИЛ (индекс локализации)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm tabular-nums"
              value={il}
              onChange={(e) => setIl(parseFloat(e.target.value) || 0)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">ИРП, ₽/ед.</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm tabular-nums"
              value={irp}
              onChange={(e) => setIrp(parseFloat(e.target.value) || 0)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="text-muted-foreground">Дни заказа (период прогноза)</span>
            <input
              type="number"
              step="1"
              min="1"
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm tabular-nums"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10) || 0)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 text-sm">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Стоимость доставки 1 ед.</span>
            <span className="text-lg font-semibold tabular-nums">{formatRub(perUnit)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">За {days} д.</span>
            <span className="text-lg font-semibold tabular-nums">{formatRub(totalForPeriod)}</span>
          </div>
        </div>

        {selected && (
          <p className="text-[11px] text-muted-foreground">
            Формула: {volumeL < 1 ? `volume × liter × coef` : `(base + (volume−1) × liter) × coef`} × ИЛ + ИРП.
            База: {selected.boxDeliveryBase.toFixed(2)} ₽, литр: {selected.boxDeliveryLiter.toFixed(2)} ₽,
            коэф склада: {selected.warehouseCoef.toFixed(2).replace(/\.?0+$/, '')}.
          </p>
        )}
      </div>
    </CategoryCard>
  );
}
