# fetch-wb-report

Еженедельный фетч отчёта о реализации FBO (сырьё + нормализация).

## Секреты

- `WB_API_TOKEN` — категории: Статистика + Финансы (read-only).

## Query params

- `?days=N` — глубина первого фетча в днях (default 30). Для истории за 8 недель: `?days=60`.

## Логика

- Если в `wb_reports_fact` уже есть данные — берёт max(rr_dt) - 7 дней (перезаливка последней недели).
- Если пусто — берёт `lookbackDays` дней назад.
- UPSERT по `srid` (уникальный ID транзакции WB) — идемпотентно.
- При получении дублей в одной странице — дедупликация в Map до UPSERT.
- Пагинация через `rrdid` до достижения всех страниц (макс 10 для защиты).

## Cron

```sql
-- Понедельник 06:30 UTC = 09:30 МСК (WB публикует отчёт пн утром)
select cron.schedule(
  'fetch-wb-report-weekly',
  '30 6 * * 1',
  $$select net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.functions.supabase.co/fetch-wb-report',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );$$
);
```

## Rate limit

/reportDetailByPeriod жёстко лимитируется при частых вызовах (может быть >5 мин кулдауна). Не вызывай вручную чаще раза в 5 минут.
