# fetch-wb-stocks

Ежедневный фетч остатков с WB Statistics API → `wb_stocks` + `wb_stocks_history`.

## Секреты (Supabase Edge Function Secrets)

- `WB_API_TOKEN` — токен из ЛК Продавца (Настройки → Доступ к API). Категория: Статистика.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase подставляет автоматически.

## Локальный запуск

```bash
supabase functions serve fetch-wb-stocks --no-verify-jwt --env-file .env
```

## Прод

Cron в Supabase Studio → Database → Cron Jobs:

```sql
select cron.schedule(
  'fetch-wb-stocks-daily',
  '0 6 * * *',  -- 06:00 UTC = 09:00 МСК
  $$ select net.http_post(
      url := 'https://hcebwgjgppwaguqittpi.functions.supabase.co/fetch-wb-stocks',
      headers := jsonb_build_object('Content-Type', 'application/json')
    ); $$
);
```

## Надёжность

- UPSERT по бизнес-ключу: `wb_stocks(barcode, warehouse_name)`, `wb_stocks_history(snapshot_date, barcode, warehouse_name)` — повторный запуск не дублирует.
- WB API недоступен → `ingestion_log.status='error'` + `error_text`, старые данные не трогаются.
- Ошибка отображается в `v_data_quality` (check_name='ingestion_error').
