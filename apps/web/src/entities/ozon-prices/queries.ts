import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  OzonActionRow,
  OzonBoostRow,
  OzonPriceProblemRow,
  OzonPriceRow,
} from './types';

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

/**
 * Цены Ozon с тарифами площадки. Порядок - от худшей маржи к лучшей:
 * первая строка сразу про то, где с ценой хуже всего.
 */
export async function fetchOzonPrices(): Promise<OzonPriceRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v_ozon_ekonomika_ceny')
    .select(
      'offer_id, tovar, cena, commission_pct_fbo, komissiya_rub, logistika_rub, dostavka_rub, ekvayring_rub, zaberyot_ozon, ostanetsya, sebestoimost, pribyl, marzha_pct, index_cvet',
    )
    .range(0, 5000);

  if (error) {
    console.error('[fetchOzonPrices]', error);
    return [];
  }

  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    article: String(r.offer_id ?? ''),
    title: (r.tovar as string | null) ?? null,
    price: num(r.cena),
    commissionPct: numOrNull(r.commission_pct_fbo),
    commissionRub: numOrNull(r.komissiya_rub),
    logistics: numOrNull(r.logistika_rub),
    delivery: numOrNull(r.dostavka_rub),
    acquiring: numOrNull(r.ekvayring_rub),
    takesOzon: numOrNull(r.zaberyot_ozon),
    left: numOrNull(r.ostanetsya),
    costPrice: numOrNull(r.sebestoimost),
    profit: numOrNull(r.pribyl),
    marginPct: numOrNull(r.marzha_pct),
    indexColor: (r.index_cvet as string | null) ?? null,
  }));

  return rows.sort((a, b) => (a.marginPct ?? 999) - (b.marginPct ?? 999));
}

/**
 * Где цена работает против нас. Пустой список - значит с ценами всё ровно,
 * и страница про это молчит.
 */
export async function fetchOzonPriceProblems(): Promise<OzonPriceProblemRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v_ozon_ceny_problemy')
    .select('offer_id, tovar, cena, sebestoimost, pribyl, marzha_pct, index_cvet, chto_ne_tak')
    .range(0, 5000);

  if (error) {
    console.error('[fetchOzonPriceProblems]', error);
    return [];
  }

  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    article: String(r.offer_id ?? ''),
    title: (r.tovar as string | null) ?? null,
    price: num(r.cena),
    costPrice: numOrNull(r.sebestoimost),
    profit: numOrNull(r.pribyl),
    marginPct: numOrNull(r.marzha_pct),
    indexColor: (r.index_cvet as string | null) ?? null,
    problem: (r.chto_ne_tak as string | null) ?? null,
  }));

  // Убыток и тонкая маржа вперёд, индекс цены следом: терять деньги хуже,
  // чем хуже показываться.
  return rows.sort((a, b) => (a.profit ?? 0) - (b.profit ?? 0));
}

/** Акции Ozon: какие идут и где мы. */
export async function fetchOzonActions(): Promise<OzonActionRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ozon_actions')
    .select('action_id, title, action_type, uchastvuem, tovarov_uchastvuet, tovarov_mozhno, date_end')
    .range(0, 500);

  if (error) {
    console.error('[fetchOzonActions]', error);
    return [];
  }

  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    actionId: num(r.action_id),
    title: (r.title as string | null) ?? null,
    kind: (r.action_type as string | null) ?? null,
    participating: (r.uchastvuem as boolean | null) ?? null,
    productsIn: numOrNull(r.tovarov_uchastvuet),
    productsCould: numOrNull(r.tovarov_mozhno),
    endsAt: (r.date_end as string | null) ?? null,
  }));

  // Где участвуем - выше; среди остальных вперёд те, куда есть что завести.
  return rows.sort(
    (a, b) =>
      Number(b.participating) - Number(a.participating) ||
      (b.productsCould ?? 0) - (a.productsCould ?? 0),
  );
}

/**
 * Цена против продвижения. Сортируем по потере на штуке: дешевле всего
 * поднять продвижение там, где потеря меньше.
 */
export async function fetchOzonBoost(): Promise<OzonBoostRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v_ozon_akcii_vygoda')
    .select(
      'akciya, offer_id, tovar, cena_bez_akcii, akcionnaya_cena, cena_dlya_max_busting, busting_seychas, busting_max, pribyl_seychas, pribyl_pri_max_bustinge, poteryaem_na_shtuke',
    )
    .range(0, 5000);

  if (error) {
    console.error('[fetchOzonBoost]', error);
    return [];
  }

  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    action: (r.akciya as string | null) ?? null,
    article: String(r.offer_id ?? ''),
    title: (r.tovar as string | null) ?? null,
    priceNoAction: numOrNull(r.cena_bez_akcii),
    actionPrice: numOrNull(r.akcionnaya_cena),
    priceForMaxBoost: numOrNull(r.cena_dlya_max_busting),
    boostNow: numOrNull(r.busting_seychas),
    boostMax: numOrNull(r.busting_max),
    profitNow: numOrNull(r.pribyl_seychas),
    profitAtMaxBoost: numOrNull(r.pribyl_pri_max_bustinge),
    lossPerUnit: numOrNull(r.poteryaem_na_shtuke),
  }));

  return rows.sort((a, b) => (a.lossPerUnit ?? 0) - (b.lossPerUnit ?? 0));
}
