import type {
  CommissionTariff,
  LogisticsTariff,
  StorageTariff,
  PenaltyTariff,
  DimensionTariff,
  PersonalIndices,
} from './types';

export const mockCommissions: CommissionTariff[] = [
  { id: 'c1', marketplace: 'WB', category: 'Спорт/Фитнес', fboCommission: 17, fbsCommission: 14, updatedAt: '2026-05-20T00:00:00Z' },
  { id: 'c2', marketplace: 'WB', category: 'Дом/Стирка', fboCommission: 19, fbsCommission: 16, updatedAt: '2026-05-12T00:00:00Z' },
  { id: 'c3', marketplace: 'OZON', category: 'Электроника', fboCommission: 14, fbsCommission: 12, updatedAt: '2026-04-02T00:00:00Z' },
  { id: 'c4', marketplace: 'OZON', category: 'Красота/Уход', fboCommission: 21, fbsCommission: 18, updatedAt: '2026-05-28T00:00:00Z' },
  { id: 'c5', marketplace: 'WB', category: 'Канцелярия', fboCommission: 23, fbsCommission: 20, updatedAt: '2026-03-15T00:00:00Z' },
  { id: 'c6', marketplace: 'OZON', category: 'Дом/Кухня', fboCommission: 18, fbsCommission: 15, updatedAt: '2026-05-25T00:00:00Z' },
  { id: 'c7', marketplace: 'WB', category: 'Аптека', fboCommission: 13, fbsCommission: 12, updatedAt: '2026-05-30T00:00:00Z' },
  { id: 'c8', marketplace: 'OZON', category: 'Авто', fboCommission: 24, fbsCommission: 22, updatedAt: '2026-02-10T00:00:00Z' },
];

export const mockLogistics: LogisticsTariff[] = [
  { id: 'l1', marketplace: 'WB', warehouse: 'Хоруги', region: 'Московская обл.', sortingCost: 45, deliveryCost: 72, updatedAt: '2026-05-18T00:00:00Z' },
  { id: 'l2', marketplace: 'WB', warehouse: 'Казань', region: 'Татарстан', sortingCost: 38, deliveryCost: 55, updatedAt: '2026-05-22T00:00:00Z' },
  { id: 'l3', marketplace: 'WB', warehouse: 'Сарапул', region: 'Удмуртия', sortingCost: 32, deliveryCost: 48, updatedAt: '2026-04-10T00:00:00Z' },
  { id: 'l4', marketplace: 'OZON', warehouse: 'Электросталь', region: 'Московская обл.', sortingCost: 58, deliveryCost: 89, updatedAt: '2026-05-29T00:00:00Z' },
  { id: 'l5', marketplace: 'OZON', warehouse: 'Тверь', region: 'Тверская обл.', sortingCost: 42, deliveryCost: 64, updatedAt: '2026-03-22T00:00:00Z' },
];

export const mockStorage: StorageTariff[] = [
  { id: 's1', marketplace: 'WB', warehouse: 'Хоруги', perLiterDay: 0.12, perUnitDay: 0.6, updatedAt: '2026-05-18T00:00:00Z' },
  { id: 's2', marketplace: 'WB', warehouse: 'Казань', perLiterDay: 0.09, perUnitDay: 0.45, updatedAt: '2026-05-22T00:00:00Z' },
  { id: 's3', marketplace: 'WB', warehouse: 'Сарапул', perLiterDay: 0.07, updatedAt: '2026-04-12T00:00:00Z' },
  { id: 's4', marketplace: 'OZON', warehouse: 'Электросталь', perLiterDay: 0.18, perUnitDay: 0.85, updatedAt: '2026-05-29T00:00:00Z' },
  { id: 's5', marketplace: 'OZON', warehouse: 'Тверь', perLiterDay: 0.11, perUnitDay: 0.5, updatedAt: '2026-03-25T00:00:00Z' },
];

export const mockPenalties: PenaltyTariff[] = [
  { id: 'p1', marketplace: 'WB', reason: 'Просрочка отгрузки', amount: 1500, unit: 'за нарушение', severity: 'high' },
  { id: 'p2', marketplace: 'WB', reason: 'Брак при приёмке', amount: 350, unit: 'за единицу', severity: 'mid' },
  { id: 'p3', marketplace: 'OZON', reason: 'Неверная маркировка', amount: 5000, unit: 'за нарушение', severity: 'high' },
  { id: 'p4', marketplace: 'OZON', reason: 'Отсутствие штрихкода', amount: 50, unit: 'за единицу', severity: 'low' },
  { id: 'p5', marketplace: 'WB', reason: 'Несоответствие категории', amount: 2500, unit: 'за нарушение', severity: 'high' },
  { id: 'p6', marketplace: 'OZON', reason: 'Нарушение упаковки', amount: 180, unit: 'за единицу', severity: 'mid' },
];

export const mockDimensions: DimensionTariff[] = [
  { id: 'd1', marketplace: 'WB', category: 'Малый объём', volumeMin: 0, volumeMax: 5, surcharge: 0, updatedAt: '2026-05-20T00:00:00Z' },
  { id: 'd2', marketplace: 'WB', category: 'Средний объём', volumeMin: 5, volumeMax: 10, surcharge: 35, updatedAt: '2026-05-20T00:00:00Z' },
  { id: 'd3', marketplace: 'OZON', category: 'Крупный объём', volumeMin: 10, volumeMax: 30, surcharge: 95, updatedAt: '2026-05-22T00:00:00Z' },
  { id: 'd4', marketplace: 'OZON', category: 'КГТ', volumeMin: 30, volumeMax: 100, surcharge: 180, updatedAt: '2026-04-12T00:00:00Z' },
];

export const mockPersonalIndices: PersonalIndices = {
  localizationIndex: 12,
  ratingScore: 4.7,
  complianceScore: 96,
  updatedAt: '2026-06-01T00:00:00Z',
};
