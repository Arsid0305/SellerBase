export type ComponentKey =
  | 'commission'
  | 'logistics'
  | 'storage'
  | 'acquiring'
  | 'penalty'
  | 'deduction'
  | 'rebillLogistic'
  | 'cogs'
  | 'tax'
  | 'returns';

export const COMPONENT_LABEL: Record<ComponentKey, string> = {
  commission: 'Комиссия WB',
  logistics: 'Логистика',
  storage: 'Хранение',
  acquiring: 'Эквайринг',
  penalty: 'Штрафы',
  deduction: 'Удержания',
  rebillLogistic: 'Перевыставленная логистика',
  cogs: 'Себестоимость',
  tax: 'УСН',
  returns: 'Возвраты',
};

export type WeekBreakdown = {
  weekStart: string;
  byCardRub: number;
  ppvzForPayRub: number;
  netProfitRub: number;
  marginPct: number | null;
  components: Record<ComponentKey, number>;
};

export type SkuMarginAnalysis = {
  nmId: number;
  myArticle: string | null;
  title: string | null;
  subjectName: string | null;
  weeks: WeekBreakdown[];
  current: WeekBreakdown;
  prevAvg: WeekBreakdown | null;
  deltaPct: number | null;
  worstComponent: { key: ComponentKey; deltaPctOfRevenue: number } | null;
};
