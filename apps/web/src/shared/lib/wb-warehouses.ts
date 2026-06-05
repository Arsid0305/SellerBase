/**
 * Хардкод-фолбэк актуального списка складов WB.
 * Реальный список тянется runtime из `SELECT DISTINCT warehouse_name FROM wb_stocks`,
 * этот используется когда таблица пустая / при первом запуске.
 */
export const WB_WAREHOUSES = [
  'Электросталь',
  'Коледино',
  'Тула',
  'Рязань (Тюшевское)',
  'Краснодар',
  'Невинномысск',
  'Волгоград',
  'Самара (Новосемейкино)',
  'Казань',
  'Котовск',
  'Подольск',
] as const;

export type WbWarehouseName = (typeof WB_WAREHOUSES)[number] | string;
