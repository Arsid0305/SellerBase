-- Phase 1 · безопасность.
-- Включаем RLS на всех таблицах без политик — это блокирует
-- доступ через anon/authenticated до появления auth и политик.
-- Service_role (Edge Functions, MCP) RLS обходит — пайплайны работают.

alter table sku_catalog          enable row level security;
alter table wb_reports_fact_raw  enable row level security;
alter table wb_reports_fact      enable row level security;
alter table wb_stocks            enable row level security;
alter table wb_stocks_history    enable row level security;
alter table app_settings         enable row level security;
alter table ingestion_log        enable row level security;
