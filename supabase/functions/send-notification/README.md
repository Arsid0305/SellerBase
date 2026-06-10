# send-notification

Универсальная отправка уведомления по 3 каналам.

## Вызов

```bash
curl -X POST https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/send-notification \
  -H "Content-Type: application/json" \
  -d '{"kind":"deficit","severity":"critical","title":"SKU 12345 заканчивается","body":"Остаток 3 шт","link":"/deficit"}'
```

Поля: `kind` (обяз.), `title` (обяз.), `severity` (`info`|`warning`|`critical`, по умолч. `info`), `body`, `link`.

## Логика

1. Всегда пишет запись в `notifications` (колокольчик увидит).
2. Тихие часы (МСК = UTC+3, окно `[quiet_from, quiet_to)` из `notification_settings`):
   если `severity != 'critical'` и сейчас тихий час — Telegram/Push НЕ отправляются.
   `critical` игнорирует тихие часы.
3. Telegram — всем активным подписчикам (`channel='telegram'`, `is_active=true`).
4. Web Push — всем активным push-подписчикам, если заданы VAPID-ключи.
   Протухшие подписки (404/410) автоматически деактивируются.

## Web Push — генерация VAPID-ключей

Сгенерировать пару (один раз, локально):

```bash
npx web-push generate-vapid-keys
```

Вывод:
```
Public Key:  BXxxxx...
Private Key: yyyy...
```

Прописать в секреты:

**Supabase Edge Function secrets** (для отправки):
```bash
supabase secrets set VAPID_PUBLIC_KEY="BXxxxx..." VAPID_PRIVATE_KEY="yyyy..." --project-ref hcebwgjgppwaguqittpi
# опционально:
supabase secrets set VAPID_SUBJECT="mailto:admin@sellerbase.app" --project-ref hcebwgjgppwaguqittpi
```

**Next.js env** (для подписки в браузере) — публичный ключ:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BXxxxx...
```

Без VAPID-ключей: запись в `notifications` и Telegram работают,
кнопка «Включить push» в UI показывает «Push не настроен» и задизейблена.

## verify_jwt

`verify_jwt = false` в `supabase/config.toml` — функция вызывается из pg_cron / других функций.
