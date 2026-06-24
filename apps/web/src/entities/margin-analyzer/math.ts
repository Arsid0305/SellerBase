import { TAX_PCT } from '@/shared/lib/business-rules';
import type { ComponentKey, WeekBreakdown } from './types';

export type BreakdownRow = {
  week_start: string;
  by_card_rub: number | null;
  ppvz_for_pay_rub: number | null;
  commission_full_rub: number | null;
  logistics_rub: number | null;
  storage_rub: number | null;
  acquiring_rub: number | null;
  penalty_rub: number | null;
  deduction_rub: number | null;
  rebill_logistic_rub: number | null;
  returns_rub: number | null;
  cogs_rub: number | null;
  net_profit_rub: number | null;
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function rowToWeek(row: BreakdownRow): WeekBreakdown {
  const byCard = toNumber(row.by_card_rub);
  const net = toNumber(row.net_profit_rub);
  const components: Record<ComponentKey, number> = {
    commission: toNumber(row.commission_full_rub),
    logistics: toNumber(row.logistics_rub),
    storage: toNumber(row.storage_rub),
    acquiring: toNumber(row.acquiring_rub),
    penalty: toNumber(row.penalty_rub),
    deduction: toNumber(row.deduction_rub),
    rebillLogistic: toNumber(row.rebill_logistic_rub),
    cogs: toNumber(row.cogs_rub),
    tax: byCard * TAX_PCT,
    returns: toNumber(row.returns_rub),
  };
  return {
    weekStart: row.week_start,
    byCardRub: byCard,
    ppvzForPayRub: toNumber(row.ppvz_for_pay_rub),
    netProfitRub: net,
    marginPct: byCard > 0 ? (net / byCard) * 100 : null,
    components,
  };
}

export function pickWorstComponent(
  current: WeekBreakdown,
  prevAvg: WeekBreakdown,
): { key: ComponentKey; deltaPctOfRevenue: number } | null {
  if (current.byCardRub <= 0 || prevAvg.byCardRub <= 0) return null;
  let worst: { key: ComponentKey; deltaPctOfRevenue: number } | null = null;
  (Object.keys(current.components) as ComponentKey[]).forEach((key) => {
    const curPct = current.components[key] / current.byCardRub;
    const prevPct = prevAvg.components[key] / prevAvg.byCardRub;
    const delta = curPct - prevPct;
    if (delta > 0 && (!worst || delta > worst.deltaPctOfRevenue)) {
      worst = { key, deltaPctOfRevenue: delta };
    }
  });
  return worst;
}

export function avgWeeks(weeks: WeekBreakdown[]): WeekBreakdown | null {
  if (weeks.length === 0) return null;
  const n = weeks.length;
  const summed: WeekBreakdown = {
    weekStart: '__avg__',
    byCardRub: 0,
    ppvzForPayRub: 0,
    netProfitRub: 0,
    marginPct: null,
    components: {
      commission: 0, logistics: 0, storage: 0, acquiring: 0, penalty: 0,
      deduction: 0, rebillLogistic: 0, cogs: 0, tax: 0, returns: 0,
    },
  };
  for (const w of weeks) {
    summed.byCardRub += w.byCardRub;
    summed.ppvzForPayRub += w.ppvzForPayRub;
    summed.netProfitRub += w.netProfitRub;
    (Object.keys(summed.components) as ComponentKey[]).forEach((k) => {
      summed.components[k] += w.components[k];
    });
  }
  const avg: WeekBreakdown = {
    ...summed,
    byCardRub: summed.byCardRub / n,
    ppvzForPayRub: summed.ppvzForPayRub / n,
    netProfitRub: summed.netProfitRub / n,
    components: { ...summed.components },
  };
  (Object.keys(avg.components) as ComponentKey[]).forEach((k) => {
    avg.components[k] = summed.components[k] / n;
  });
  avg.marginPct = avg.byCardRub > 0 ? (avg.netProfitRub / avg.byCardRub) * 100 : null;
  return avg;
}
