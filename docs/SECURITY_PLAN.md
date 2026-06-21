# Security Plan — макс. безопасность + multi-tenant fork

> Сохранено 2026-06-21 по запросу владелицы — «когда я тебя спрошу, выдай в таком же виде». Триггерные фразы: «безопасность», «план по безопасности», «многопользовательский режим», «друзьям предложить», «Dashboard сессия».

---

## Контекст

3 открытых пункта по безопасности (в `tasks/todo.md` → «⏸ Требует решения владелицы»):

1. `verify_jwt = true` на edge functions vs X-Cron-Secret (PR #146)
2. Реальная Auth для API routes (`/api/costs`, `/api/demo/clear`)
3. Установка `CRON_SHARED_SECRET` в Supabase после мерджа PR #146

Решение владелицы: **«сделать максимально безопасно, чтобы избежать случайных или неслучайных вмешательств»**.

---

## План «слоистая защита» (defense-in-depth — все слои одновременно)

### (1) Edge functions — двойная защита

**План:** `verify_jwt = true` + `X-Cron-Secret` оба слоя.
- Внешний атакующий: упирается в JWT-проверку Supabase (не дойдёт до кода функции).
- Внутренний баг / утечка JWT: вторая проверка по shared secret в коде функции.

**Что делает Claude (агент A после согласования):**
- Меняет `supabase/config.toml` → `verify_jwt = true` для всех 16 функций.
- Переписывает pg_cron-команды: добавляет `Authorization: Bearer <service_role_jwt>` через `current_setting('app.settings.service_role_key', true)`.
- `X-Cron-Secret` уже в PR #146 — остаётся.

### (2) API routes — Supabase Auth + middleware

**План:** magic-link auth (один пользователь — владелица, без пароля).
- Любой запрос на `/api/*` без валидной session → 401.
- Существующая Origin/Referer-гигиена остаётся как второй слой.

**Что делает Claude (агент B):**
- Страница `/login` — поле email + кнопка «Прислать ссылку».
- `middleware.ts`: проверка `supabase.auth.getUser()` → если null и путь не `/login` или `/api/health` → редирект на `/login`.
- API routes: `requireAuth()` helper в каждой — 401 если нет session.
- Session TTL — 30 дней (стандарт Supabase).

### (3) CRON_SHARED_SECRET — установка

**Уже сделано в PR #146** (код функций + миграция cron'ов). Активируется после установки секрета владелицей.

---

## 15-минутная сессия владелицы в Supabase Dashboard

**Когда:** после мерджа PR #146 + PR агентов A и B.

**Действия:**

1. **Supabase Secrets** (Dashboard → Project Settings → Edge Functions → Secrets):
   ```
   CRON_SHARED_SECRET = <openssl rand -hex 32>
   ```
   Hex сгенерирует Claude и пришлёт в чат.

2. **SQL Editor** — 2 ALTER DATABASE:
   ```sql
   ALTER DATABASE postgres SET app.settings.cron_shared_secret = '<тот же hex>';
   ALTER DATABASE postgres SET app.settings.service_role_key = '<service_role JWT из Settings → API>';
   ```

3. **Auth → Providers → Email**:
   - Email = on
   - Magic-link = on
   - **Sign-up = disabled** (max security — только invite)

4. **Auth → URL Configuration**:
   - Site URL = `https://<ваш-vercel-домен>` (иначе magic-link уведёт на localhost)
   - Redirect URLs = добавить `https://<ваш-vercel-домен>/**`

5. **Auth → Users → Add user**:
   - Email = твой email
   - Без пароля (magic-link)

**Зафиксировать риск:** при ротации service_role JWT в Supabase нужно обновить `app.settings.service_role_key` в БД, иначе все cron упадут одновременно. Поставить напоминание раз в полгода / при ротации.

---

## Multi-tenant fork — если когда-нибудь подключать друзей

### Что меняется

| Сейчас (single-tenant) | Для друзей (multi-tenant) |
|---|---|
| Одна `wb_reports_fact`, все строки твои | Каждая строка с `organization_id`; RLS-политика «вижу только своё» |
| `WB_TOKEN_READ` в Supabase Secrets — твой | Токен **каждого друга** хранится в БД, шифруется (Supabase Vault) |
| Cron `fetch-wb-report` тянет твои данные | Cron перебирает всех пользователей → для каждого свой запрос |
| Auth = только ты, magic-link | Auth = sign-up открыт, onboarding wizard, billing |
| Дашборд = твои цифры | Дашборд показывает только данные текущего user'а |
| 1 пользователь, бесплатно | N пользователей — кто платит? |

### Развилка — 3 варианта

**Вариант A — single-tenant сейчас, multi-tenant потом.**
- Magic-link для тебя одного.
- Когда созреет — рефакторим: `organization_id` ко всем таблицам, RLS перевешиваем, cron переписываем, sign-up открываем.
- Минус: рефакторинг будет ~неделя работы агентов.
- Плюс: не теряешь время сейчас на функционал которым никто не пользуется.

**Вариант B — закладываем multi-tenant сразу, активируем для одного.**
- Сейчас: `organization_id` в таблицах (default = твой `org_id`), RLS-политики готовы, sign-up закрыт.
- Когда созреет — открываешь sign-up, новый user получает свой `org_id`.
- Минус: ~2 дня агентов сейчас (миграции + RLS).
- Плюс: переход «для друзей» = 1 кнопка, не рефакторинг.

**Вариант C — отдельная инстанция для каждого друга.**
- Каждому: свой клон репо + свой Supabase project + свой Vercel deploy.
- Минус: ты администрируешь N проектов, обновления катить N раз.
- Плюс: данные физически изолированы.

### 5 вопросов которые определяют выбор

1. **Когда «для друзей»?** Через месяц / полгода / год / «не уверен»?
2. **Сколько друзей реально?** 2-3 близких или публичный SaaS?
3. **Платно или дружески бесплатно?** Если платно — нужно billing (Stripe), +1 неделя.
4. **Готова админить N Supabase-проектов?** (Вариант C) Или хочешь один общий?
5. **Их техническая грамотность?** Сами получат WB-токен или нужен wizard «нажмите 3 кнопки»?

### Рекомендация без ответов на 5 вопросов

**Вариант A** + параллельно `docs/MULTI_TENANT_PLAN.md` (детальный чек-лист миграции на случай «когда созреет»). Самый дешёвый путь: не пилишь то что может не пригодиться, но и не теряешь знание о том как пилить.

---

## Статус

- ✅ План зафиксирован (этот файл) — 2026-06-21
- ⏸ Решение по варианту multi-tenant fork — ждёт ответа владелицы
- ⏸ Запуск агентов A и B — ждёт твоего «делай» после ознакомления с планом
- ⏸ Dashboard-сессия 15 минут — после агентов A и B
