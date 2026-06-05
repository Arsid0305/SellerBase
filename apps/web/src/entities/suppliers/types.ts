export type ChinaSupplier = {
  id: number;
  skuId: number;
  supplierName: string;
  link1688: string;
  priceCny: number | null;
  isDefault: boolean;
  notes: string | null;
  createdAt: string;
};

export type ChinaSupplierInput = {
  skuId: number;
  supplierName: string;
  link1688: string;
  priceCny?: number | null;
  isDefault?: boolean;
  notes?: string | null;
};

export type ChinaSupplierPatch = Partial<Omit<ChinaSupplierInput, 'skuId'>>;
