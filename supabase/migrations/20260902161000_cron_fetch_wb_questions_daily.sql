-- Крон сбора вопросов покупателей — рядом с отзывами (тот же Feedbacks API,
-- та же категория токена). Отзывы идут в 02:30, вопросы ставим на 02:40,
-- чтобы не бить в один и тот же лимит одновременно.
select cron.schedule(
  'fetch-wb-questions-daily',
  '40 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-questions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000);
  $$
);
