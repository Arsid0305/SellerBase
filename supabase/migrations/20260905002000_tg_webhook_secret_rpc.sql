-- Чтение секрета телеграм-вебхука для Edge Function.
--
-- Зачем: telegram-webhook работает без verify_jwt (Telegram не присылает JWT)
-- и доверял chat.id из тела запроса. Зная разрешённый chat_id, посторонний мог
-- отправить /mute и отключить владелице оповещения. Telegram умеет подписывать
-- каждый запрос заголовком X-Telegram-Bot-Api-Secret-Token — осталось его
-- сверять.
--
-- Почему через RPC, а не через env функции: задать переменную окружения можно
-- только из панели Supabase, а секрет в Vault кладётся из SQL. Так владелице
-- остаётся одно действие — вызвать setWebhook, — вместо двух.
--
-- Сам секрет заведён отдельно, не миграцией (значение случайное, в код не идёт):
--   SELECT vault.create_secret(encode(gen_random_bytes(24),'hex'),
--                              'telegram_webhook_secret', '<описание>');
--
-- Доступ: только service_role (им ходит сама функция). Для anon и authenticated
-- права отозваны явно, иначе секрет мог бы прочитать любой клиент.
CREATE OR REPLACE FUNCTION public.get_tg_webhook_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_webhook_secret';
$$;

REVOKE ALL ON FUNCTION public.get_tg_webhook_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_tg_webhook_secret() FROM anon;
REVOKE ALL ON FUNCTION public.get_tg_webhook_secret() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_tg_webhook_secret() TO service_role;

COMMENT ON FUNCTION public.get_tg_webhook_secret() IS
  'Секрет заголовка X-Telegram-Bot-Api-Secret-Token из Vault. Только для service_role: его читает Edge Function telegram-webhook, чтобы отличить запрос от Telegram от подделки.';
