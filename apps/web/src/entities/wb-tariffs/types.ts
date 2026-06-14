export type WbTariffsBox = {
  id: number;
  effectiveDate: string;
  warehouseName: string;
  geoName: string;
  boxDeliveryBase: number;
  boxDeliveryLiter: number;
  boxDeliveryMarketplaceBase: number;
  boxDeliveryMarketplaceLiter: number;
  boxStorageBase: number;
  boxStorageLiter: number;
  warehouseCoef: number;
};

export type WbTariffsReturn = {
  id: number;
  effectiveDate: string;
  warehouseName: string;
  geoName: string;
  returnBase: number;
  returnLiter: number;
};

export type WbTariffsBoxDynamicsPoint = {
  effectiveDate: string;
  warehouseCoef: number;
};

export type WbWarehouseCoefRow = {
  warehouseName: string;
  coef: number;     // как в БД, в шкале 100 = база
  units: number;    // твои остатки на этом складе
  sharePct: number; // доля от твоих суммарных остатков, 0-100
};

export type WbAverageWarehouseCoef = {
  coef: number;
  date: string;
  warehouseCount: number;
  warehouses?: WbWarehouseCoefRow[];
};
