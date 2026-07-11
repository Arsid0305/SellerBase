import { createAdminClient } from '@/shared/lib/supabase/admin';

export type FbwSupplyRow = {
  supplyId: string;
  name: string | null;
  dateCreated: string | null;
  warehouseName: string | null;
  status: string | null;
  boxesCount: number | null;
  unitsTotal: number;
  invoiceTotalRub: number;
  deliveryPerUnitRub: number | null;
};

export type SupplyInvoice = {
  id: number;
  supplyId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string;
  amountRub: number;
  ffName: string | null;
  comment: string | null;
  fileUrl: string | null;
};

export async function fetchFbwSupplies(limit = 200): Promise<FbwSupplyRow[]> {
  const supabase = createAdminClient();
  const [{ data: sups }, { data: per }] = await Promise.all([
    supabase
      .from('wb_supplies_v2')
      .select('id, name, date_created, warehouse_name, status, boxes_count')
      .order('date_created', { ascending: false })
      .limit(limit),
    supabase.from('v_delivery_to_wb_per_unit').select('supply_id, units_total, invoice_total_rub, delivery_to_wb_rub_per_unit'),
  ]);
  const perBySupply = new Map<string, { units: number; invoice: number; perUnit: number | null }>();
  for (const p of (per ?? []) as Array<{
    supply_id: string;
    units_total: number | null;
    invoice_total_rub: number | null;
    delivery_to_wb_rub_per_unit: number | null;
  }>) {
    perBySupply.set(p.supply_id, {
      units: Number(p.units_total ?? 0),
      invoice: Number(p.invoice_total_rub ?? 0),
      perUnit: p.delivery_to_wb_rub_per_unit != null ? Number(p.delivery_to_wb_rub_per_unit) : null,
    });
  }
  return ((sups ?? []) as Array<{
    id: string;
    name: string | null;
    date_created: string | null;
    warehouse_name: string | null;
    status: string | null;
    boxes_count: number | null;
  }>).map((s) => {
    const p = perBySupply.get(s.id) ?? { units: 0, invoice: 0, perUnit: null };
    return {
      supplyId: s.id,
      name: s.name,
      dateCreated: s.date_created,
      warehouseName: s.warehouse_name,
      status: s.status,
      boxesCount: s.boxes_count,
      unitsTotal: p.units,
      invoiceTotalRub: p.invoice,
      deliveryPerUnitRub: p.perUnit,
    };
  });
}

export async function fetchInvoicesBySupply(supplyId: string): Promise<SupplyInvoice[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('delivery_to_wb_invoices')
    .select('id, supply_id, invoice_number, invoice_date, amount_rub, ff_name, comment, file_url')
    .eq('supply_id', supplyId)
    .order('invoice_date', { ascending: false });
  return ((data ?? []) as Array<{
    id: number;
    supply_id: string | null;
    invoice_number: string | null;
    invoice_date: string;
    amount_rub: number;
    ff_name: string | null;
    comment: string | null;
    file_url: string | null;
  }>).map((r) => ({
    id: r.id,
    supplyId: r.supply_id,
    invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date,
    amountRub: Number(r.amount_rub),
    ffName: r.ff_name,
    comment: r.comment,
    fileUrl: r.file_url,
  }));
}
