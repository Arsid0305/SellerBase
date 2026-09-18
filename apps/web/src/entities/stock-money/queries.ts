import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { StockMoneyRow } from './types';

type Raw = {
  poryadok: number;
  vid: string;
  stroka: string;
  shtuk: number | null;
  rublei: number | string | null;
  pometka: string | null;
};

/**
 * Остатки в рублях одной таблицей.
 *
 * Считает база (v_stock_money), здесь только перевод в названия страницы.
 * Расчёт не дублируем: сводка ходит в те же цифры, и два места счёта
 * разойдутся при первой же правке.
 */
export async function fetchStockMoney(): Promise<StockMoneyRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v_stock_money')
    .select('poryadok, vid, stroka, shtuk, rublei, pometka')
    .order('poryadok', { ascending: true });

  if (error) {
    console.error('[fetchStockMoney]', error);
    return [];
  }

  return ((data ?? []) as Raw[]).map((r) => ({
    order: r.poryadok,
    kind: r.vid === 'itog' ? 'itog' : 'stroka',
    label: r.stroka,
    units: Number(r.shtuk ?? 0),
    rub: Number(r.rublei ?? 0),
    note: r.pometka,
  }));
}
