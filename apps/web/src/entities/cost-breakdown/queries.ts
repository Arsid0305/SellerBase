import { createAdminClient } from '@/shared/lib/supabase/admin';

export type CostBreakdownSource = 'unit_import' | 'cogs_calc' | 'sku_catalog_legacy' | 'none';

export interface CostBreakdown {
  skuId: number;
  wbArticle: number | null;
  myArticle: string | null;
  title: string | null;
  totalCostRubPerUnit: number;
  purchaseRubPerUnit: number | null;
  cargoRubPerUnit: number | null;
  customsRubPerUnit: number | null;
  packagingRubPerUnit: number | null;
  ffServiceRubPerUnit: number | null;
  /** true → ffServiceRubPerUnit взят из ручного override (sku_catalog.manual_ff_tariff_rub) */
  ffIsManualOverride: boolean;
  totalWithExtrasRubPerUnit: number | null;
  effectiveFrom: string | null;
  source: CostBreakdownSource;
}

type ViewRow = {
  sku_id: number;
  wb_article: number | null;
  my_article: string | null;
  title: string | null;
  total_cost_rub_per_unit: number | string;
  purchase_rub_per_unit: number | string | null;
  cargo_rub_per_unit: number | string | null;
  customs_rub_per_unit: number | string | null;
  packaging_rub_per_unit: number | string | null;
  ff_service_rub_per_unit: number | string | null;
  total_with_extras_rub_per_unit: number | string | null;
  effective_from: string | null;
  source: CostBreakdownSource;
};

function toNumberOrNull(v: number | string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchCostBreakdown(): Promise<CostBreakdown[]> {
  const supabase = createAdminClient();
  const [viewRes, overridesRes] = await Promise.all([
    supabase
      .from('v_sku_cost_breakdown')
      .select(
        'sku_id, wb_article, my_article, title, total_cost_rub_per_unit, purchase_rub_per_unit, cargo_rub_per_unit, customs_rub_per_unit, packaging_rub_per_unit, ff_service_rub_per_unit, total_with_extras_rub_per_unit, effective_from, source',
      )
      .order('my_article', { ascending: true }),
    supabase.from('sku_catalog').select('id, manual_ff_tariff_rub').not('manual_ff_tariff_rub', 'is', null),
  ]);

  if (viewRes.error) {
    console.error('[fetchCostBreakdown] error', viewRes.error);
    return [];
  }

  const overrideMap = new Map<number, number>();
  for (const r of (overridesRes.data ?? []) as { id: number; manual_ff_tariff_rub: number | string | null }[]) {
    const v = toNumberOrNull(r.manual_ff_tariff_rub);
    if (v != null) overrideMap.set(r.id, v);
  }

  return ((viewRes.data ?? []) as ViewRow[]).map((r) => {
    const override = overrideMap.get(r.sku_id);
    const ffFromView = toNumberOrNull(r.ff_service_rub_per_unit);
    const ffEffective = override ?? ffFromView;
    const totalCost = Number(r.total_cost_rub_per_unit) || 0;
    const totalWithExtras =
      override != null ? totalCost + override : toNumberOrNull(r.total_with_extras_rub_per_unit);
    return {
      skuId: r.sku_id,
      wbArticle: r.wb_article,
      myArticle: r.my_article,
      title: r.title,
      totalCostRubPerUnit: totalCost,
      purchaseRubPerUnit: toNumberOrNull(r.purchase_rub_per_unit),
      cargoRubPerUnit: toNumberOrNull(r.cargo_rub_per_unit),
      customsRubPerUnit: toNumberOrNull(r.customs_rub_per_unit),
      packagingRubPerUnit: toNumberOrNull(r.packaging_rub_per_unit),
      ffServiceRubPerUnit: ffEffective,
      ffIsManualOverride: override != null,
      totalWithExtrasRubPerUnit: totalWithExtras,
      effectiveFrom: r.effective_from,
      source: r.source,
    };
  });
}
