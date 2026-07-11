-- PR-C: счета от ФФ за FBW-поставки + view автоформулы delivery_to_wb_rub_per_unit.

CREATE TABLE IF NOT EXISTS public.delivery_to_wb_invoices (
  id              bigserial PRIMARY KEY,
  supply_id       text REFERENCES public.wb_supplies_v2(id) ON DELETE SET NULL,
  invoice_number  text,
  invoice_date    date NOT NULL,
  amount_rub      numeric(12,2) NOT NULL,
  ff_name         text,
  comment         text,
  file_url        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_to_wb_invoices_supply_idx ON public.delivery_to_wb_invoices (supply_id);
CREATE INDEX IF NOT EXISTS delivery_to_wb_invoices_date_idx ON public.delivery_to_wb_invoices (invoice_date DESC);
COMMENT ON TABLE public.delivery_to_wb_invoices IS 'Счета от ФФ за доставку FBW-поставки на WB склад.';

CREATE OR REPLACE VIEW public.v_delivery_to_wb_per_unit AS
SELECT
  s.id AS supply_id,
  s.date_created,
  s.warehouse_name,
  COALESCE((SELECT SUM(i.quantity) FROM public.wb_supply_items_v2 i WHERE i.supply_id = s.id), 0) AS units_total,
  COALESCE((SELECT SUM(iv.amount_rub) FROM public.delivery_to_wb_invoices iv WHERE iv.supply_id = s.id), 0) AS invoice_total_rub,
  CASE
    WHEN (SELECT SUM(i.quantity) FROM public.wb_supply_items_v2 i WHERE i.supply_id = s.id) > 0
     AND (SELECT SUM(iv.amount_rub) FROM public.delivery_to_wb_invoices iv WHERE iv.supply_id = s.id) > 0
    THEN ROUND(
      (SELECT SUM(iv.amount_rub) FROM public.delivery_to_wb_invoices iv WHERE iv.supply_id = s.id) /
      NULLIF((SELECT SUM(i.quantity) FROM public.wb_supply_items_v2 i WHERE i.supply_id = s.id), 0), 2)
    ELSE NULL
  END AS delivery_to_wb_rub_per_unit
FROM public.wb_supplies_v2 s;

COMMENT ON VIEW public.v_delivery_to_wb_per_unit IS 'Доставка на единицу по FBW-поставке (сумма счетов ФФ / сумма quantity).';
