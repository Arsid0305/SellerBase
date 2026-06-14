-- Дропнуть сырой архив отчётов WB (459 MB, не читается из фронта/бэка).
-- fetch-wb-report больше не пишет туда после правки index.ts.

DROP TABLE IF EXISTS public.wb_reports_fact_raw;
