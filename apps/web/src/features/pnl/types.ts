export type ExpenseCategory = {
  key: string;
  label: string;
  amount: number;
  share: number; // 0..100, доля от выручки
  delta: number; // ₽, изменение vs прошлый период
  group: 'mp' | 'logistics' | 'product' | 'finance' | 'marketing' | 'penalty' | 'other' | 'extra';
};

export type PnlKpis = {
  revenue: { value: number; delta: number; series: number[] };
  expenses: { value: number; delta: number; series: number[] };
  profit: { value: number; delta: number; series: number[] };
  margin: { value: number; delta: number; series: number[] }; // Маржа % (0..100)
};

export type ProfitMarginPoint = { date: string; margin: number };

export type PnlSummary = {
  period: { from: string; to: string; label: string };
  comparison: { from: string; to: string; label: string };
  kpis: PnlKpis;
  categories: ExpenseCategory[];
  marginSeries: ProfitMarginPoint[];
};
