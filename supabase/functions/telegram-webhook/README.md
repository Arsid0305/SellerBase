# telegram-webhook

Приём webhook от Telegram-бота **@SellerBase_bot**.

## Команды
- `/start` — подписка (сохраняет `chat_id` в `notification_subscribers`, channel=`telegram`)
- `/mute` — пауза (`is_active=false`)
- `/unmute` — возобновить
- `/status` — текущий статус

## Регистрация webhook (один раз, после деплоя)

`TELEGRAM_BOT_TOKEN` уже в Edge Function secrets, но для `setWebhook` токен нужно
подставить вручную (это разовая команда с твоей машины):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/telegram-webhook"
```

Проверить:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Снять webhook:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook"
```

`verify_jwt = false` в `supabase/config.toml` — иначе Telegram получит 401.
