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
  localizationIndex: number; // множитель, выше 1 = выгоднее
  salesDistributionIndex: number; // %, доп. логистика при низкой локализации
  complianceScore: number; // %
  updatedAt: string;
};

export type TariffTabKey = 'commission' | 'logistics' | 'storage' | 'penalty' | 'dimension';

export type LogisticsVolumeBucket = {
  fromLitres: number;
  toLitres: number;
  ratePerLitre: number; // ₽
};

export type BaseLogisticsTariffs = {
  bigItemBaseRate: number; // ₽ за 1-й литр (>1 л)
  bigItemAdditionalRate: number; // ₽ за каждый доп. литр
  volumeBuckets: LogisticsVolumeBucket[]; // для товаров < 1 л
  reverseLogisticsFreezeDaysMin: number;
  reverseLogisticsFreezeDaysMax: number;
  updatedAt: string;
};
