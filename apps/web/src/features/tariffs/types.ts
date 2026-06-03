export type TariffMarketplace = 'WB' | 'OZON';

export type CommissionTariff = {
  id: string;
  marketplace: TariffMarketplace;
  category: string;
  fboCommission: number; // %
  fbsCommission: number; // %
  updatedAt: string; // ISO
};

export type LogisticsTariff = {
  id: string;
  marketplace: TariffMarketplace;
  warehouse: string;
  region: string;
  sortingCost: number; // ₽
  deliveryCost: number; // ₽
  updatedAt: string;
};

export type StorageTariff = {
  id: string;
  marketplace: TariffMarketplace;
  warehouse: string;
  perLiterDay: number; // ₽
  perUnitDay?: number; // ₽
  updatedAt: string;
};

export type PenaltyUnit = 'за нарушение' | 'за единицу' | '%';
export type PenaltySeverity = 'low' | 'mid' | 'high';

export type PenaltyTariff = {
  id: string;
  marketplace: TariffMarketplace;
  reason: string;
  amount: number; // ₽
  unit: PenaltyUnit;
  severity: PenaltySeverity;
};

export type DimensionTariff = {
  id: string;
  marketplace: TariffMarketplace;
  category: string;
  volumeMin: number; // л
  volumeMax: number; // л
  surcharge: number; // ₽
  updatedAt: string;
};

export type PersonalIndices = {
  localizationIndex: number; // % +/-
  ratingScore: number; // 1..5
  complianceScore: number; // %
  updatedAt: string;
};

export type TariffTabKey = 'commission' | 'logistics' | 'storage' | 'penalty' | 'dimension';
