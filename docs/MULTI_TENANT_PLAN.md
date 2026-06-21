# Multi-tenant Migration Plan

> Детальный чек-лист миграции SellerBase из single-tenant в multi-tenant. Создано 2026-06-21 как превентивная дока — реализуется когда владелица скажет «делаем для друзей». Сейчас НЕ начинать.

---

## Контекст

**Сейчас (single-tenant):**
- Одна владелица, один WB-токен (`WB_TOKEN_READ` в Supabase Secrets)
- Все таблицы общие — нет разделения по пользователям
- RLS включён, но реально не различает users
- API routes защищены Origin/Referer (PR #138)
- Cron'ы один на всех — раз в N времени тянут «общие» данные

**Цель (multi-tenant):**
- Несколько пользователей, каждый свой WB-токен (зашифрованный в БД)
- Полная изоляция данных через `organization_id` + RLS
- Каждый пользователь видит только свои данные
- Cron'ы перебирают всех пользователей по очереди
- Onboarding wizard, billing (опционально)

---

## Развилка — 3 варианта (из `SECURITY_PLAN.md`)

| Вариант | Плюсы | Минусы | Когда применять |
|---|---|---|---|
| **A — single сейчас, multi-tenant потом** | Нет работы сейчас | Большой рефакторинг (~неделя) когда созреет | Если «друзья» — гипотеза, может не случиться |
| **B — закладываем multi-tenant, активируем для одного** | Переход = 1 кнопка | ~2 дня работы сейчас | Если уверена что в течение 3-6 мес. подключим |
| **C — отдельные инстанции на каждого** | Физическая изоляция | Админить N проектов | Друзей 2-3, готова катить обновления N раз |

**Текущее решение (21.06):** Вариант A — single-tenant сейчас, multi-tenant потом. Этот документ — путь рефакторинга на «потом».

---

## Чек-лист миграции Single → Multi-tenant (Вариант A → B/C)

### Phase 0 — Пререкизит: реальная Auth (1-2 дня)

**До многопользовательского режима — нужен реальный Auth (см. `SECURITY_PLAN.md` пункт 2). Без него `organization_id` некому привязывать.**

- [ ] Включить Supabase Auth (email/magic-link, как в SECURITY_PLAN)
- [ ] `/login` страница + `middleware.ts` проверка session
- [ ] Завести таблицу `organizations (id, name, created_at, owner_user_id)` 
- [ ] Завести таблицу `org_members (org_id, user_id, role)` — для будущих команд
- [ ] При создании user → автоматически создавать `organization` + `org_member` (owner)
- [ ] Хелпер `getCurrentOrgId(req)` в `apps/web/src/shared/lib/auth.ts`

### Phase 1 — Схема БД: добавить `organization_id` во все таблицы (1 день)

**Принцип:** каждая «бизнес-таблица» получает `organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`. Default — `org_id` владелицы (для бэкфилла существующих строк).

Список таблиц требующих миграции:
- [ ] `sku_catalog`
- [ ] `wb_reports_fact`
- [ ] `wb_stocks`, `wb_stocks_history`
- [ ] `wb_sales_fact`
- [ ] `wb_orders_fact`
- [ ] `wb_ads_fact`
- [ ] `wb_promotions`, `wb_promotion_items`
- [ ] `wb_commissions_by_subject` (общая для всех или per-org? — категории WB одинаковые, оставить общей)
- [ ] `wb_sales_funnel`, `wb_sales_funnel_period`
- [ ] `china_orders`, `china_order_items`
- [ ] `cargo_shipments`, `cargo_shipment_orders`, `cargo_tariffs`
- [ ] `cogs_calculations`, `cogs_history`
- [ ] `sku_cost_history`
- [ ] `sku_events`, `sku_snapshots`
- [ ] `supply_plans`, `supply_plan_items`, `supply_plan_china`
- [ ] `goals`, `tasks`, `problems`
- [ ] `marketing_expenses`, `cash_flow`
- [ ] `pricing_settings`, `app_settings` (общие → возможно per-org)
- [ ] `ingestion_log` (общая или per-org?)
- [ ] `notifications_*` таблицы
- [ ] `sku_cost_breakdown` view — обновить

**Миграция:**
```sql
ALTER TABLE public.wb_reports_fact ADD COLUMN organization_id BIGINT 
  REFERENCES public.organizations(id) ON DELETE CASCADE 
  DEFAULT 1;  -- owner's org_id
UPDATE public.wb_reports_fact SET organization_id = 1 WHERE organization_id IS NULL;
ALTER TABLE public.wb_reports_fact ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.wb_reports_fact ALTER COLUMN organization_id DROP DEFAULT;
CREATE INDEX wb_reports_fact_org_idx ON public.wb_reports_fact (organization_id, rr_dt);
```
Применить во всех таблицах.

### Phase 2 — RLS политики (полдня)

**Принцип:** заменить существующие RLS на проверку `organization_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())`.

```sql
DROP POLICY IF EXISTS "owner_read" ON public.wb_reports_fact;
CREATE POLICY "members_read" ON public.wb_reports_fact FOR SELECT
  USING (organization_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "members_write" ON public.wb_reports_fact FOR INSERT WITH CHECK (
  organization_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
);
-- + UPDATE, DELETE аналогично
```

Применить ко всем таблицам с `organization_id`. **Сверка:** для текущей владелицы все запросы должны возвращать ровно те же цифры что и до миграции.

### Phase 3 — WB токены per-organization (полдня)

- [ ] Таблица `org_wb_tokens (org_id, token_encrypted, token_categories TEXT[], created_at, last_used_at)`
- [ ] Шифрование через Supabase Vault (`vault.create_secret`)
- [ ] Onboarding: при создании org → форма «введите WB API token» → сохраняем зашифрованным
- [ ] В edge functions: вместо `Deno.env.get('WB_TOKEN_READ')` → читать из БД по `org_id`

### Phase 4 — Cron'ы перебирают все организации (1-2 дня)

**Это самая болезненная часть.** Сейчас `fetch-wb-report` тянет «все данные». В multi-tenant — каждый org свой токен → свой запрос → свои данные с `organization_id`.

**Архитектура:**
```sql
-- Cron job вместо прямого вызова функции:
SELECT cron.schedule(
  'fetch-wb-report-weekly',
  '0 3 * * 2',
  $cron$
    SELECT net.http_post(
      url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', ...,
        'X-Org-Id', o.id::text
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    )
    FROM public.organizations o
    WHERE o.is_active = true;
  $cron$
);
```

В edge function — принимать `X-Org-Id`, читать токен из БД, писать данные с этим `organization_id`.

**Особенность:** rate limiter WB API per-token. Если у двух org одинаковый токен (теоретически невозможно но) — лимит делится. Per-org: каждый ловит свой 429 независимо.

### Phase 5 — UI селектор организации (полдня)

- [ ] В header дашборда — селектор `<OrgSwitcher>` (если у user'а несколько org через `org_members`)
- [ ] Сохранять выбранный `org_id` в cookie / session
- [ ] Передавать в каждый API call
- [ ] **Сейчас:** у владельца один org → селектор скрыт.

### Phase 6 — Onboarding wizard (1 день)

Для новых пользователей:
1. Sign-up через magic-link (email)
2. Auto-создание `organization` + `org_member`
3. Wizard «Подключите WB» — поле WB-токен + инструкция как его получить
4. Wizard «Загрузите себестоимость» — кнопка загрузки UNIT.xlsx (опционально)
5. Через 24-48 часов первые данные подтягиваются cron'ом

### Phase 7 — Billing (если платный SaaS, 1-2 недели)

- [ ] Stripe Customer + Subscription
- [ ] Plans: Free (1 SKU? 10?), Starter (50 SKU, ₽X/мес), Pro (unlimited, ₽Y/мес)
- [ ] Webhook от Stripe → `org_subscriptions (org_id, plan, status, expires_at)`
- [ ] Middleware: если subscription expired → редирект на `/billing`
- [ ] Если друзьям бесплатно — Phase 7 пропустить.

### Phase 8 — Документация и onboarding доки

- [ ] Видео «Как получить WB-токен» (5 минут)
- [ ] `docs/USER_GUIDE.md` — что делает каждый дашборд
- [ ] FAQ — типичные ошибки (отозванный токен, нет данных, и т.п.)

---

## Эстимация полной миграции

| Phase | Время | Можно автономно Claude? |
|---|---|---|
| 0 — Auth | 1-2 дня | Да, агент B из SECURITY_PLAN |
| 1 — Схема (org_id во все таблицы) | 1 день | Да, агент с миграциями |
| 2 — RLS политики | 0.5 дня | Да, агент со сверкой |
| 3 — WB токены per-org + Vault | 0.5 дня | Частично — нужно решение по шифрованию |
| 4 — Cron'ы перебирают org | 1-2 дня | Да, агент с тестированием на 1 org |
| 5 — UI селектор | 0.5 дня | Да |
| 6 — Onboarding wizard | 1 день | Частично — UX-решения от владелицы |
| 7 — Billing (опц.) | 1-2 недели | Только структура, Stripe-интеграция |
| 8 — Доки | 0.5 дня | Частично |
| **ИТОГО без billing** | **~6-7 дней** | Большинство автономно |
| **ИТОГО с billing** | **~3 недели** | |

---

## Чек-лист «перед началом» (когда созреет)

- [ ] Ответы на 5 вопросов из `SECURITY_PLAN.md`:
  1. Когда «для друзей»?
  2. Сколько друзей?
  3. Платно или бесплатно?
  4. Один Supabase project или несколько?
  5. Их тех. грамотность?
- [ ] Прочитан Phase 0 (Auth) — потому что без него не начать
- [ ] Прочитан Phase 7 (Billing) — потому что определяет архитектуру таблиц
- [ ] Создана ветка `claude/multi-tenant-migration` для серии PR
- [ ] Зарезервирован slot на ~неделю работы агентов

---

## Альтернативы которые рассматривали

**Вариант C — отдельные Supabase проекты на друга:**
- Плюс: zero миграция, физическая изоляция, владелица друга получает свой Dashboard
- Минус: N WB-токенов в N проектах, обновления катить N раз через `git push` в N форков
- Когда применять: 2-3 близких друга, готова админить вручную.

**Решение:** если друзей 2-3 и не хочется морочиться — Вариант C проще. Если планируется 10+ или превращение в SaaS — Вариант B (multi-tenant).

---

## Статус

- ✅ План зафиксирован — 2026-06-21
- ⏸ Не реализуется. Возобновить когда владелица скажет «делаем для друзей».
- Триггерные фразы для возобновления: «multi-tenant», «друзьям предложить», «подключить друга», «multi-tenant план».
