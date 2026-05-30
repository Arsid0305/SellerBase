# sync-sheets — выгрузка SellerBase → Google Sheets

## Что выгружается
При каждом запуске функция чистит и перезаполняет 4 вкладки:

| Вкладка | Источник | Окно |
|---|---|---|
| **P&L по SKU** | `get_full_pnl_by_period()` | последние 30 дней |
| **Остатки** | `wb_stocks` | текущий снапшот |
| **Поставка** | `v_supply_recommendation` | всё |
| **Cash Flow** | `v_cash_flow_by_month` | всё |

Формулы оптимально выносить в колонки **правее выгружаемых данных** — функция их не трогает (чистит `A:Z`, но обычно данных много больше 26 колонок — в ревизии расширим исключение).

## Нужно для деплоя

### 1. Google Cloud Service Account
- Console: https://console.cloud.google.com
- IAM → Service Accounts → Create:
  - Name: `sellerbase-sheets`
  - Roles: `Editor` (или более узкий: `Sheets Editor` через IAM)
- На странице аккаунта → Keys → Add key → JSON → скачать.
- Содержимое файла пойдёт в env `GOOGLE_SA_JSON`.

### 2. Google Sheets API
- Console → APIs & Services → Library → Google Sheets API → Enable.

### 3. Сама Google-таблица
- Создай новую Google Sheet (или используй существующую).
- Создай вкладки: `P&L по SKU`, `Остатки`, `Поставка`, `Cash Flow`.
- Share → впиши email сервис-аккаунта (из JSON-ключа, поле `client_email`) → роль **Editor**.
- URL: `docs.google.com/spreadsheets/d/<SHEET_ID>/...` — `<SHEET_ID>` пойдёт в env `GOOGLE_SHEET_ID`.

### 4. Деплой
```bash
export GOOGLE_SA_JSON='{"type":"service_account",...}'
export GOOGLE_SHEET_ID='1abc...XYZ'
# WB_API_TOKEN здесь НЕ нужен (про него функция не знает).

cd ~/Downloads/yc-functions/sync-sheets
npm install --silent
powershell.exe -NoProfile -Command "Compress-Archive -Path .\* -DestinationPath ..\sync-sheets.zip -Force"
cd ~/Downloads/yc-functions

yc serverless function create --name sync-sheets --folder-id b1gumjic8uebc4m8aq9g 2>/dev/null || true
yc serverless function version create \
  --folder-id b1gumjic8uebc4m8aq9g \
  --function-name sync-sheets \
  --runtime nodejs18 --entrypoint index.handler \
  --memory 256m --execution-timeout 540s \
  --source-path "$(pwd)/sync-sheets.zip" \
  --environment "SUPABASE_URL=https://hcebwgjgppwaguqittpi.supabase.co,SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},GOOGLE_SA_JSON=${GOOGLE_SA_JSON},GOOGLE_SHEET_ID=${GOOGLE_SHEET_ID}"
yc serverless function allow-unauthenticated-invoke --name sync-sheets

yc serverless function get --name sync-sheets --format json | grep -m1 '"id"'
```

### 5. pg_cron на ежечасовой запуск
```sql
select cron.schedule(
  'sync-sheets-hourly',
  '0 * * * *',
  $$select net.http_post(
    url := 'https://functions.yandexcloud.net/<id>',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );$$
);
```

## Ограничения наброска (0.1.0)
- `Range A:Z` при очистке — 26 колонок; формулы в AA+ будут живы. Для большего запаса можно расширить.
- Нет incremental update — каждый запуск полный sync (нормально для наших объёмов).
- Вкладка `Поставка` — raw колонки из view (подпишем в версии 0.2 после ревью фактической схемы).
