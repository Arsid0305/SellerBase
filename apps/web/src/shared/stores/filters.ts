import { create } from 'zustand';

export type MarketplaceKey = 'WB' | 'OZON';
export type PeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'quarter' | 'custom';

export type CustomRange = { from: string; to: string };

type FiltersState = {
  period: PeriodPreset;
  customRange?: CustomRange;
  marketplaces: MarketplaceKey[];
  setPeriod: (period: PeriodPreset) => void;
  setCustomRange: (range: CustomRange) => void;
  toggleMarketplace: (m: MarketplaceKey) => void;
  setMarketplaces: (m: MarketplaceKey[]) => void;
};

export const useFiltersStore = create<FiltersState>((set) => ({
  period: '30d',
  marketplaces: ['WB', 'OZON'],
  setPeriod: (period) => set({ period }),
  setCustomRange: (customRange) => set({ customRange, period: 'custom' }),
  toggleMarketplace: (m) =>
    set((s) => {
      const exists = s.marketplaces.includes(m);
      const next = exists ? s.marketplaces.filter((x) => x !== m) : [...s.marketplaces, m];
      // Не даём выключить все каналы сразу
      return { marketplaces: next.length === 0 ? s.marketplaces : next };
    }),
  setMarketplaces: (marketplaces) => set({ marketplaces: marketplaces.length > 0 ? marketplaces : ['WB'] }),
}));

export function periodLabel(period: PeriodPreset, customRange?: CustomRange): string {
  const map: Record<PeriodPreset, string> = {
    today: 'Сегодня',
    yesterday: 'Вчера',
    '7d': '7 дней',
    '30d': '30 дней',
    month: 'Месяц',
    quarter: 'Квартал',
    custom: customRange ? `${customRange.from} — ${customRange.to}` : 'Произвольный',
  };
  return map[period];
}

export function comparisonLabel(period: PeriodPreset): string {
  const map: Record<PeriodPreset, string> = {
    today: 'Вчера',
    yesterday: 'Позавчера',
    '7d': 'Прошлые 7 дней',
    '30d': 'Прошлые 30 дней',
    month: 'Прошлый месяц',
    quarter: 'Прошлый квартал',
    custom: 'Аналогичный период ранее',
  };
  return map[period];
}
