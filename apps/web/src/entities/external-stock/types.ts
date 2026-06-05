export type ExternalStockLocation = 'home' | 'ff';

export type ExternalStock = {
  id: number;
  skuId: number;
  location: ExternalStockLocation;
  quantity: number;
  updatedAt: string;
};
