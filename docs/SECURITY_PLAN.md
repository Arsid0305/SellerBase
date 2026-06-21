# SECURITY_PLAN — SellerBase

Single-tenant, режим «максимальной безопасности». Edge functions защищены
двумя независимыми слоями.

---

## Два слоя защиты edge functions

| Слой | Где проверяется                | Чем            | Что блокирует                                    |
|------|--------------------------------|----------------|--------------------------------------------------|
| 1    | Supabase (до запуска функции)  | `verify_jwt=true` в `config.toml` → проверка `Authorization: Bearer <JWT>` | Любой запрос без валидного Supabase JWT — 401. |
| 2    | Внутри функции (`_shared/auth.ts`) | сравнение `X-Cron-Secret` с `Deno.env.CRON_SHARED_SECRET` | Случайные внутренние вызовы без знания shared secret. |

Исключение: `telegram-webhook` — `verify_jwt=false`, т.к. Telegram шлёт
свой апдейт без Supabase JWT (защита через secret в URL пути / IP-список).

---

## Секреты

### Edge Function Secrets (`Deno.env`, через `supabase secrets set`)

- `WB_TOKEN_READ` — токен WB API.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Telegram-алерты.
- `CRON_SHARED_SECRET` — сравнивается с заголовком `X-Cron-Secret`.
- Системные (авто): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

### Supabase Vault (для pg_cron → net.http_post)

⚠️ **`ALTER DATABASE postgres SET app.settings.*` в Supabase НЕ РАБОТАЕТ** —
требует superuser, недоступного облачному пользователю. Старые рецепты с
`current_setting('app.settings.xxx', true)` нерабочие. Везде Vault.

| Имя в Vault          | Источник                                                |
|----------------------|---------------------------------------------------------|
| `cron_shared_secret` | Тот же hex что `CRON_SHARED_SECRET` в Edge Secrets.     |
| `service_role_key`   | service_role JWT, Dashboard → Settings → API → service_role. |

Установка (Dashboard → SQL Editor, выполняет владелица один раз):
```sql
SELECT vault.create_secret('<long-random-hex>',  'cron_shared_secret');
SELECT vault.create_secret('<service_role JWT>', 'service_role_key');
```

Чтение в миграциях cron:
```sql
coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = '...'), '')
```

### Риски ротации

- **service_role JWT ротируется** (Dashboard → Settings → API → Reset) →
  ВСЕ cron'ы начнут падать с 401 (verify_jwt отвергнет старый JWT).
  Перед ротацией: обновить Vault.
  ```sql
  UPDATE vault.secrets SET secret = vault.encrypted_secret('<новый JWT>')
  WHERE name = 'service_role_key';
  ```
- **`CRON_SHARED_SECRET` меняется** → обновить в обоих местах синхронно:
  ```bash
  supabase secrets set CRON_SHARED_SECRET='<новый hex>'
  ```
  ```sql
  UPDATE vault.secrets SET secret = vault.encrypted_secret('<тот же hex>')
  WHERE name = 'cron_shared_secret';
  ```

---

## Порядок раскатывания `verify_jwt=true`

Миграция `20260621100001_cron_with_service_role_jwt.sql` переплана 13 cron jobs
так чтобы они слали `Authorization: Bearer <service_role JWT>`.

**Не мержить PR до того как `service_role_key` появится в Vault** — иначе все
cron'ы будут падать с 401 пока миграция не доедет.

Последовательность:
1. Владелица: Dashboard → SQL Editor →
   `SELECT vault.create_secret('<service_role JWT>', 'service_role_key');`
2. Мерж PR → `migrate.yml` применяет миграцию → cron'ы начинают слать оба header'а.
3. `supabase functions deploy` (через CI) подхватывает новый `config.toml` с `verify_jwt=true`.
