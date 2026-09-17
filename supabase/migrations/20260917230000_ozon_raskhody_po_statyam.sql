-- Расходы Ozon по статьям и месяцам.
--
-- Ozon называет услуги своими кодами (MarketplaceServiceItem...). Здесь коды
-- сводятся к статьям, которыми владелица ведёт свой P&L: логистика, хранение,
-- продвижение, эквайринг, приёмка, штрафы.
--
-- Недели Ozon режет по границам месяцев сам: последняя неделя месяца
-- обрывается его последним днём, следующая начинается первым числом. Поэтому
-- месяц берётся по началу недели и раскладка точная, без дробления.
--
-- Незнакомый код падает в «Прочее» и виден в v_ozon_services_neznakomye -
-- потерять его молча нельзя.

create or replace function public.ozon_service_group(p_name text)
returns text
language sql
immutable
as $$
  select case p_name
    when 'MarketplaceServiceItemDirectFlowLogisticSum'          then 'Логистика'
    when 'MarketplaceServiceItemRedistributionLastMileCourier'  then 'Логистика'
    when 'MarketplaceServiceItemDeliveryToHandoverPlaceOzon'    then 'Логистика'
    when 'MarketplaceServiceItemReturnFlowLogistic'             then 'Логистика'
    when 'MarketplaceServiceItemRedistributionReturnsPVZ'       then 'Логистика'
    when 'MarketplaceServiceProductMovementFromWarehouse'       then 'Логистика'

    when 'MarketplaceServiceStorageItem'                        then 'Хранение'
    when 'MarketplaceProductDisposal'                           then 'Хранение'

    when 'MarketplaceElectronicServicePointforReviews'          then 'Продвижение'
    when 'ItemAgentServiceStarsMembership'                      then 'Продвижение'
    when 'MarketplaceServiceItemElectronicServicePinReview'     then 'Продвижение'
    when 'MarketplaceServiceItemProductReviewsManagementSubscription' then 'Продвижение'
    when 'MarketplaceServiceItemElectronicServicesPremiumSellerBonusAccrual' then 'Продвижение'
    when 'MarketplaceServiseItemPointsAwarded'                  then 'Продвижение'

    when 'MarketplaceRedistributionOfAcquiringItem'             then 'Эквайринг'

    when 'MarketplaceServiceItemCrossdocking'                   then 'Приёмка и поставка'
    when 'MarketplaceServiceItemSupplyInboundAdditional'        then 'Приёмка и поставка'
    when 'MarketplaceServiceItemSupplyInboundCargoShortage'     then 'Приёмка и поставка'
    when 'MarketplaceServiceItemSupplyInboundCargoSurplus'      then 'Приёмка и поставка'
    when 'MarketplaceServiceItemPackageMaterialsProvision'      then 'Приёмка и поставка'

    when 'MarketplaceSellerDecompensationItemByTypeDocOperation' then 'Штрафы и претензии'
    when 'AccrualInternalClaim'                                 then 'Штрафы и претензии'
    when 'AccrualConsigDefectiveWriteOff'                       then 'Штрафы и претензии'
    when 'AccrualConsigWriteOff'                                then 'Штрафы и претензии'
    when 'MarketplaceServiceSellerReturnsCargoAssortment'       then 'Штрафы и претензии'

    else 'Прочее'
  end;
$$;

comment on function public.ozon_service_group(text) is
  'Код услуги Ozon -> статья расходов в терминах P&L владелицы.';

create or replace view public.v_ozon_expenses_by_month as
select
  date_trunc('month', s.period_begin)::date as mesyac,
  public.ozon_service_group(s.name)         as statya,
  round(sum(s.price), 2)                    as summa,
  count(distinct s.period_begin)            as nedel
from public.ozon_services s
group by 1, 2;

comment on view public.v_ozon_expenses_by_month is
  'Расходы Ozon по статьям и месяцам. Минус - расход, плюс - возврат или компенсация.';

-- Коды, которых нет в разборе: если Ozon заведёт новую услугу, она видна здесь,
-- а не растворяется в «Прочем» без следа.
create or replace view public.v_ozon_services_neznakomye as
select name, count(*) as nedel, round(sum(price), 2) as summa
from public.ozon_services
where public.ozon_service_group(name) = 'Прочее'
group by name
order by sum(price);

comment on view public.v_ozon_services_neznakomye is
  'Услуги Ozon, не разложенные по статьям. Проверять при разборе расходов.';
