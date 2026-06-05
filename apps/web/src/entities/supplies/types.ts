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

export type SkuWarehouseStats = {
  skuId: number;
  myArticle: string | null;
  wbArticle: number | null;
  barcode: string | null;
  title: string | null;
  salesByWarehouse: Record<string, number>;
  stocksByWarehouse: Record<string, number>;
  homeStock: number;
  ffStock: number;
  recommendByWarehouse: Record<string, number>;
};
