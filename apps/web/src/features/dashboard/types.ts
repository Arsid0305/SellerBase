export type DailyPoint = {
  date: string; // ISO yyyy-mm-dd
  revenue: number;
  expenses: number;
  commission: number;
  logistics: number;
};

export type ChannelShare = {
  channel: 'WB' | 'OZON';
  label: string;
  share: number; // 0..100
  delta: number; // -100..100
  amount: number; // ₽
};

export type DashboardKpi = {
  label: string;
  value: number;
  delta: number;
  series: number[];
  hint?: string;
};

export type DashboardSummary = {
  period: { from: string; to: string; label: string };
  comparison: { from: string; to: string; label: string };
  kpis: {
    revenue: DashboardKpi;
    mainExpenses: DashboardKpi;
    extraExpenses: DashboardKpi;
    profit: DashboardKpi;
    margin: DashboardKpi;
  };
  channels: ChannelShare[];
  series: DailyPoint[];
};
