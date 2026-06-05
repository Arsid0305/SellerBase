import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { ProductEvent } from './types';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type CatalogRow = { id: number; wb_article: number | null };
type FactRow = { rr_dt: string; quantity: number | null; retail_price: number | null };
type StockRow = { quantity: number | null };

export async function fetchProductEvents(barcode: string): Promise<ProductEvent[]> {
  const supabase = createAdminClient();
  const c = await supabase
    .from('sku_catalog')
    .select('id, wb_article')
    .eq('barcode', barcode)
    .limit(1)
    .maybeSingle();
  const catalog = (c.data ?? null) as CatalogRow | null;
  if (!catalog?.wb_article) return [];

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const since = new Date(todayUtc);
  since.setUTCDate(since.getUTCDate() - 29);

  const [factsRes, stocksRes] = await Promise.all([
    supabase
      .from('wb_reports_fact')
      .select('rr_dt, quantity, retail_price')
      .eq('nm_id', catalog.wb_article)
      .gte('rr_dt', iso(since))
      .lte('rr_dt', iso(todayUtc))
      .order('rr_dt', { ascending: true })
      .range(0, 50_000),
    supabase
      .from('wb_stocks')
      .select('quantity')
      .eq('nm_id', catalog.wb_article)
      .range(0, 1000),
  ]);

  const facts = (factsRes.data ?? []) as FactRow[];
  const stocks = (stocksRes.data ?? []) as StockRow[];

  const byDay = new Map<string, { units: number; priceSum: number; priceN: number }>();
  for (const f of facts) {
    const q = toNumber(f.quantity);
    const p = toNumber(f.retail_price);
    const day = byDay.get(f.rr_dt) ?? { units: 0, priceSum: 0, priceN: 0 };
    if (q > 0) {
      day.units += q;
      if (p > 0) {
        day.priceSum += p;
        day.priceN += 1;
      }
    }
    byDay.set(f.rr_dt, day);
  }

  const days = [...byDay.entries()]
    .map(([date, v]) => ({
      date,
      units: v.units,
      price: v.priceN > 0 ? v.priceSum / v.priceN : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const events: ProductEvent[] = [];

  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1]!;
    const cur = days[i]!;
    if (prev.price > 0 && cur.price > 0) {
      const delta = (cur.price - prev.price) / prev.price;
      if (delta >= 0.05) {
        events.push({
          date: cur.date,
          kind: 'PRICE_UP',
          severity: 'info',
          title: 'Цена выросла',
          detail: `${Math.round(prev.price)} ₽ → ${Math.round(cur.price)} ₽ (+${Math.round(delta * 100)}%)`,
        });
      } else if (delta <= -0.05) {
        events.push({
          date: cur.date,
          kind: 'PRICE_DOWN',
          severity: 'info',
          title: 'Цена снизилась',
          detail: `${Math.round(prev.price)} ₽ → ${Math.round(cur.price)} ₽ (${Math.round(delta * 100)}%)`,
        });
      }
    }
  }

  const totalUnits = days.reduce((a, d) => a + d.units, 0);
  const avgPerDay = days.length > 0 ? totalUnits / days.length : 0;
  if (avgPerDay > 0) {
    for (const d of days) {
      if (d.units >= avgPerDay * 2 && d.units >= 3) {
        events.push({
          date: d.date,
          kind: 'SALES_SPIKE',
          severity: 'info',
          title: 'Резкий рост продаж',
          detail: `${d.units} шт за день (×${(d.units / avgPerDay).toFixed(1)} от среднего)`,
        });
      } else if (d.units > 0 && d.units <= avgPerDay * 0.3 && avgPerDay >= 3) {
        events.push({
          date: d.date,
          kind: 'SALES_DROP',
          severity: 'warn',
          title: 'Резкий спад продаж',
          detail: `${d.units} шт за день (×${(d.units / avgPerDay).toFixed(1)} от среднего)`,
        });
      }
    }
  }

  const totalStock = stocks.reduce((a, s) => a + toNumber(s.quantity), 0);
  if (totalStock <= 0 && avgPerDay > 0) {
    events.push({
      date: iso(todayUtc),
      kind: 'STOCK_OUT',
      severity: 'critical',
      title: 'Нет остатков',
      detail: `Упущенная выручка растёт при спросе ${avgPerDay.toFixed(1)} шт/день`,
    });
  } else if (avgPerDay > 0 && totalStock > 0 && totalStock / avgPerDay < 7) {
    events.push({
      date: iso(todayUtc),
      kind: 'STOCK_LOW',
      severity: 'warn',
      title: 'Низкие остатки',
      detail: `${totalStock} шт, хватит на ${Math.floor(totalStock / avgPerDay)} дн при спросе ${avgPerDay.toFixed(1)} шт/день`,
    });
  }

  const lastSaleDay = [...days].reverse().find((d) => d.units > 0)?.date;
  if (totalStock > 0 && lastSaleDay) {
    const gap = Math.floor((todayUtc.getTime() - new Date(`${lastSaleDay}T00:00:00Z`).getTime()) / 86_400_000);
    if (gap > 7) {
      events.push({
        date: iso(todayUtc),
        kind: 'NO_SALES',
        severity: 'warn',
        title: `Нет продаж ${gap} дней`,
        detail: `Остаток ${totalStock} шт, последняя продажа ${lastSaleDay}`,
      });
    }
  }

  events.sort((a, b) => b.date.localeCompare(a.date));
  return events.slice(0, 30);
}
