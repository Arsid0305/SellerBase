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
  effectiveFrom: string | null;
  source: CostBreakdownSource;
  transportToFfRubPerUnit: number | null;
  ffServiceRubPerUnit: number | null;
  deliveryToWbRubPerUnit: number | null;
  totalWithExtrasRubPerUnit: number | null;
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
  effective_from: string | null;
  source: CostBreakdownSource;
  transport_to_ff_rub_per_unit: number | string | null;
  ff_service_rub_per_unit: number | string | null;
  delivery_to_wb_rub_per_unit: number | string | null;
  total_with_extras_rub_per_unit: number | string | null;
};

function toNumberOrNull(v: number | string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchCostBreakdown(): Promise<CostBreakdown[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v_sku_cost_breakdown')
    .select(
      'sku_id, wb_article, my_article, title, total_cost_rub_per_unit, purchase_rub_per_unit, cargo_rub_per_unit, customs_rub_per_unit, packaging_rub_per_unit, effective_from, source, transport_to_ff_rub_per_unit, ff_service_rub_per_unit, delivery_to_wb_rub_per_unit, total_with_extras_rub_per_unit',
    )
    .order('my_article', { ascending: true });

  if (error) {
    console.error('[fetchCostBreakdown] error', error);
    return [];
  }

  return ((data ?? []) as ViewRow[]).map((r) => ({
    skuId: r.sku_id,
    wbArticle: r.wb_article,
    myArticle: r.my_article,
    title: r.title,
    totalCostRubPerUnit: Number(r.total_cost_rub_per_unit) || 0,
    purchaseRubPerUnit: toNumberOrNull(r.purchase_rub_per_unit),
    cargoRubPerUnit: toNumberOrNull(r.cargo_rub_per_unit),
    customsRubPerUnit: toNumberOrNull(r.customs_rub_per_unit),
    packagingRubPerUnit: toNumberOrNull(r.packaging_rub_per_unit),
    effectiveFrom: r.effective_from,
    source: r.source,
    transportToFfRubPerUnit: toNumberOrNull(r.transport_to_ff_rub_per_unit),
    ffServiceRubPerUnit: toNumberOrNull(r.ff_service_rub_per_unit),
    deliveryToWbRubPerUnit: toNumberOrNull(r.delivery_to_wb_rub_per_unit),
    totalWithExtrasRubPerUnit: toNumberOrNull(r.total_with_extras_rub_per_unit),
  }));
}
