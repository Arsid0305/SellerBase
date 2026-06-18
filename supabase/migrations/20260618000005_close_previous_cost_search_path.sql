-- Fix: function close_previous_cost has role-mutable search_path (Supabase advisor warning).
-- Без явного search_path злоумышленник с правами на public может перехватить вызов через свою функцию-shadow.
-- Закрепляем search_path = pg_catalog, public.

ALTER FUNCTION public.close_previous_cost() SET search_path = pg_catalog, public;
