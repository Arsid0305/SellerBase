# SECURITY.md — Security Checklist

> Прогонять перед первым деплоем в `main` и после каждого крупного изменения схемы или Edge Functions.

## Secrets & Keys
- [ ] `service_role` key не используется в `VITE_` env vars — только в Edge Functions или GitHub Secrets
- [ ] `.env` в `.gitignore`, нет в истории git (`git log --all -- .env`)
- [ ] `WB_API_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` в GitHub Secrets, не в коде
- [ ] `build.sourcemap: true` отсутствует во фронте

## Supabase RLS
- [ ] RLS включён на каждой таблице в схеме `public`
- [ ] Политики используют `auth.uid() = user_id`, не открыты анонимам
- [ ] `app_settings` доступен на чтение всем authenticated, на запись — только владельцу

## Edge Functions
- [ ] Каждая функция верифицирует JWT: `supabase.auth.getUser(token)` → 401 если невалидно
- [ ] `user_id` берётся из верифицированного токена, не из body
- [ ] Входы валидируются через `zod` до любого DB-вызова
- [ ] CORS ограничен: `Access-Control-Allow-Origin: https://DOMAIN.com` (не `*`)
- [ ] Ошибки пишутся в `ingestion_log`, не возвращаются клиенту со стеком

## CI/CD
- [ ] Workflows используют минимальные permissions — `contents: write` только где нужно
- [ ] Actions запинены к commit SHA, не к тегу
- [ ] Секреты не echoятся в `run:` шагах
- [ ] Имя ветки / пользовательский ввод не интерполируется в `run:` shell — только через `env:`

## OWASP Quick Check
- [ ] A01 Broken Access Control — RLS на всех таблицах, JWT в каждой Edge Function
- [ ] A02 Cryptographic Failures — нет service_role во фронте, нет секретов в git
- [ ] A03 Injection — zod валидация на всех Edge Function входах, parameterized queries в SQL
- [ ] A05 Misconfiguration — CSP, CORS, headers сконфигурены
- [ ] A06 Vulnerable Components — `npm audit` в CI
- [ ] A07 Auth Failures — rate limiting на OTP, токен верифицируется на бэке
