# sync-sheets

Выгружает ключевые view в Google Sheets, чтобы видеть расчёты SellerBase в привычном интерфейсе.

## Секреты

- `GOOGLE_SA_JSON` — JSON сервис-аккаунта Google Cloud (Sheets API enabled, права Editor на целевую таблицу).
- `GOOGLE_SHEET_ID` — ID таблицы (из URL `docs.google.com/spreadsheets/d/<ID>/edit`).

## Статус

Сейчас stub. До настройки секретов возвращает 503. Полная реализация — когда будет service account.

## Листы в таблице (план)

- `PNL` — `v_pnl_by_sku`
- `Balance` — `v_warehouses_balance`
- `Supply` — `v_supply_recommendation`
- `Quality` — `v_data_quality`
