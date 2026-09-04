# Yandex Cloud Functions — SellerBase WB ingestion

> ⚠️ **Слой не используется с 2026 года — проверено 04.09.2026 по `cron.job`.**
> Оба задания, `fetch-wb-stocks-daily` и `fetch-wb-report-weekly`, бьют
> в Supabase Edge Functions, а не в `functions.yandexcloud.net`. Строки
> «pg_cron расписание» ниже описывают состояние, которого больше нет.
>
> Обход, ради которого слой заводился (WB отдавал 429 на foreign IP для
> `reportDetailByPeriod`), сейчас не нужен: `fetch-wb-report` с Supabase
> отрабатывает штатно — 7 успешных прогонов, последний 01.09.2026,
> ни одной ошибки в `ingestion_log` за 45 дней.
>
> Каталог оставлен как рабочий обходной путь на случай, если WB вернёт
> блокировку по IP. Судьба слоя — решение владелицы, см. `tasks/todo.md`.

Зачем нужно: WB API режет `/api/v5/supplier/reportDetailByPeriod` с foreign IP (Frankfurt / Supabase eu-central-1 = 429). YC Functions работают из РФ-датацентров — WB пропускает.

## Структура
```
yc-functions/
├── fetch-wb-stocks/      Node.js 18, daily — остатки
├── fetch-wb-report/      Node.js 18, weekly — отчёт о реализации
├── deploy.sh             одноразовый деплой
└── README.md             этот файл
```

## Текущие URL (production)
- stocks: `https://functions.yandexcloud.net/d4es6nv2vh64o0v0om7d`
- report: `https://functions.yandexcloud.net/d4e4s8o3oqd27qv6gs94`

Оба `allow-unauthenticated-invoke`, env-vars (`WB_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) выставлены в YC.

## pg_cron расписание
- `fetch-wb-stocks-daily` — `0 6 * * *` → YC stocks
- `fetch-wb-report-weekly` — `30 6 * * 1` → YC report (`?days=14`)

## API
### fetch-wb-stocks
- POST, body `{}`. Параметров нет.
- Делает один запрос `/api/v1/supplier/stocks`, UPSERT в `wb_stocks` + `wb_stocks_history`.

### fetch-wb-report
- POST, body `{}`. Query-параметры:
  - `?from=YYYY-MM-DD&to=YYYY-MM-DD` — явное окно (перекрывает остальное).
  - `?days=N` — fallback если в `wb_reports_fact` пусто.
  - По умолчанию: `max(rr_dt) - 7 дней` (инкрементальная докачка).
- Пагинация через `rrdid`, до 20 страниц, пауза 65 сек между страницами (WB лимит 1 req/min).
- Дедуп по `srid` внутри страницы → upsert в `wb_reports_fact_raw` и `wb_reports_fact`.

## Деплой (повтор / новые версии)
```bash
export WB_API_TOKEN='...'
export SUPABASE_SERVICE_ROLE_KEY='...'
./deploy.sh
```
Требуется YC service-account key как `key.json` рядом со скриптом. Если ключа нет — создать в console.yandex.cloud → service account `sellerbase-deployer` → Authorized keys.

## Лимиты WB
- `/reportDetailByPeriod`: ~1 req/min, 60 req/h на токен. Превышение → 429 + кулдаун.
- `/stocks`: мягче, несколько в минуту.
- Глубина истории по `reportDetailByPeriod`: WB надёжно хранит 3-6 месяцев, дальше — лотерея.
