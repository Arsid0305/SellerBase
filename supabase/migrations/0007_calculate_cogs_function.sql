-- Расчёт себестоимости по отгрузке:
-- 1. Агрегирует china_order_items по sku_id (множественные размеры в одной WB-карточке).
-- 2. Аллокация карго пропорционально весу (или другому методу из shipment).
-- 3. UPSERT в cogs_calculations, UPDATE sku_catalog.cost_price_rub, INSERT cogs_history (с closing прошлых).

create or replace function calculate_cogs_for_shipment(p_shipment_id bigint)
returns table(updated_skus int, total_purchase_rub numeric, total_allocated_rub numeric)
language plpgsql
set search_path = ''
as $$
declare
  v_total_cargo numeric;
  v_total_customs numeric;
  v_total_packaging numeric;
  v_total_weight numeric;
  v_rate numeric;
  v_method text;
  v_now timestamptz := now();
begin
  select total_cargo_rub, customs_rub, packaging_rub, total_weight_kg, exchange_rate, allocation_method
    into v_total_cargo, v_total_customs, v_total_packaging, v_total_weight, v_rate, v_method
  from public.cargo_shipments where id = p_shipment_id;

  if v_total_weight is null or v_total_weight = 0 then
    raise exception 'cargo_shipment % has no total_weight_kg', p_shipment_id;
  end if;
  if v_rate is null or v_rate = 0 then
    raise exception 'cargo_shipment % has no exchange_rate', p_shipment_id;
  end if;

  with sku_in_shipment as (
    select
      coi.sku_id,
      sum(coi.qty_shipped) as qty,
      sum(coi.qty_shipped * coi.unit_weight_kg) as weight_kg,
      sum(coi.qty_shipped * coi.price_yuan) as sum_yuan
    from public.china_order_items coi
    join public.cargo_shipment_orders cso on cso.order_id = coi.order_id
    where cso.shipment_id = p_shipment_id
      and coi.sku_id is not null
      and coi.qty_shipped > 0
      and coi.unit_weight_kg is not null
    group by coi.sku_id
  )
  insert into public.cogs_calculations (
    sku_id, shipment_id, qty,
    purchase_rub_per_unit, cargo_rub_per_unit, customs_rub_per_unit, packaging_rub_per_unit,
    allocation_method
  )
  select
    s.sku_id,
    p_shipment_id,
    s.qty::int,
    round((s.sum_yuan * v_rate) / s.qty, 4),
    round((v_total_cargo * s.weight_kg / v_total_weight) / s.qty, 4),
    round((coalesce(v_total_customs, 0) * s.weight_kg / v_total_weight) / s.qty, 4),
    round((coalesce(v_total_packaging, 0) * s.weight_kg / v_total_weight) / s.qty, 4),
    v_method
  from sku_in_shipment s
  on conflict (sku_id, shipment_id) do update set
    qty = excluded.qty,
    purchase_rub_per_unit  = excluded.purchase_rub_per_unit,
    cargo_rub_per_unit     = excluded.cargo_rub_per_unit,
    customs_rub_per_unit   = excluded.customs_rub_per_unit,
    packaging_rub_per_unit = excluded.packaging_rub_per_unit,
    allocation_method      = excluded.allocation_method,
    calculation_date       = v_now;

  update public.sku_catalog s
  set cost_price_rub = c.total_cost_rub_per_unit, updated_at = v_now
  from public.cogs_calculations c
  where c.shipment_id = p_shipment_id and c.sku_id = s.id;

  update public.cogs_history h
  set effective_to = v_now
  where h.sku_id in (select sku_id from public.cogs_calculations where shipment_id = p_shipment_id)
    and h.effective_to is null;

  insert into public.cogs_history (sku_id, effective_from, cost_price_rub, source, shipment_id)
  select sku_id, v_now, total_cost_rub_per_unit, 'shipment', p_shipment_id
  from public.cogs_calculations where shipment_id = p_shipment_id;

  return query
    select count(*)::int,
           sum(purchase_rub_per_unit * qty),
           sum((cargo_rub_per_unit + customs_rub_per_unit + packaging_rub_per_unit) * qty)
    from public.cogs_calculations where shipment_id = p_shipment_id;
end;
$$;
