-- #17: ручной ввод индексов локализации/распределения WB (API их не отдаёт).
-- Владелец раз в неделю (Пн после 06:00 MSK) переносит цифры из ЛК на /tariffs.
-- Telegram напоминает если запись за прошлую неделю не появилась.

CREATE TABLE IF NOT EXISTS public.wb_personal_indices (
  id                       bigserial PRIMARY KEY,
  week_start               date NOT NULL,
  localization_index       numeric(6,3),
  sales_distribution_index numeric(6,3),
  fbo_reliability_pct      numeric(5,2),
  note                     text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wb_personal_indices_week_uidx ON public.wb_personal_indices (week_start);
CREATE INDEX IF NOT EXISTS wb_personal_indices_created_at_idx ON public.wb_personal_indices (created_at DESC);

COMMENT ON TABLE public.wb_personal_indices IS
  'Личные индексы WB (локализации, распределения, надёжности FBO). Заполняется вручную раз в неделю — WB не отдаёт эти цифры через API.';

-- Возвращает последнюю запись
CREATE OR REPLACE FUNCTION public.get_latest_personal_indices()
 RETURNS TABLE(
   week_start date,
   localization_index numeric,
   sales_distribution_index numeric,
   fbo_reliability_pct numeric,
   note text,
   created_at timestamptz
 )
 LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  SELECT week_start, localization_index, sales_distribution_index, fbo_reliability_pct, note, created_at
  FROM public.wb_personal_indices
  ORDER BY week_start DESC, created_at DESC
  LIMIT 1;
$function$;
