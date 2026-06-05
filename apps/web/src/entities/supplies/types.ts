export type SupplyPlanStatus =
  | 'draft'
  | 'sent_to_ff'
  | 'sent_to_china'
  | 'received'
  | 'cancelled';

export const SUPPLY_PLAN_STATUSES: SupplyPlanStatus[] = [
  'draft',
  'sent_to_ff',
  'sent_to_china',
  'received',
  'cancelled',
];

export const SUPPLY_PLAN_STATUS_LABEL: Record<SupplyPlanStatus, string> = {
  draft: 'Черновик',
  sent_to_ff: 'Отправлено в ФФ',
  sent_to_china: 'Заказ в Китай',
  received: 'Получено',
  cancelled: 'Отменено',
};

export type SupplyPlan = {
  id: number;
  name: string;
  status: SupplyPlanStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  itemsCount?: number;
};

export type SupplyPlanItem = {
  id: number;
  planId: number;
  skuId: number;
  warehouseName: string;
  qty: number;
};

export type SupplyPlanChinaItem = {
  id: number;
  planId: number;
  skuId: number;
  supplierId: number | null;
  qty: number;
  priceCny: number | null;
};

export type SupplyPlanInput = {
  name: string;
  status?: SupplyPlanStatus;
  notes?: string | null;
};

export type SupplyPlanPatch = Partial<SupplyPlanInput>;

// Полный отчёт для редактирования: список SKU × склад × продажи/остатки/рекомендация
export type SkuWarehouseStats = {
  skuId: number;
  myArticle: string | null;
  wbArticle: number | null;
  barcode: string | null;
  title: string | null;
  // по складам:
  salesByWarehouse: Record<string, number>; // продано за 60д
  stocksByWarehouse: Record<string, number>; // текущий остаток WB
  homeStock: number;
  ffStock: number;
  // рекомендация по складам (везти):
  recommendByWarehouse: Record<string, number>;
};
