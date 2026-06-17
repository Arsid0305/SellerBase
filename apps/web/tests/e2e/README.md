# E2E smoke-тесты

Простые проверки что страницы открываются без ошибок: HTTP-статус < 400, нет
`pageerror` в консоли, виден заголовок (`h1`/`h2`/`[role="heading"]`).

## Запуск

```bash
pnpm --filter @sellerbase/web exec playwright install --with-deps chromium
pnpm --filter @sellerbase/web test:e2e
```

или из `apps/web`:

```bash
pnpm exec playwright test
```

По умолчанию тесты идут на `http://localhost:3000` — нужен запущенный
`pnpm dev` (или `pnpm start` после `pnpm build`) в соседнем терминале.
Чтобы указать другой адрес (например, staging):

```bash
E2E_BASE_URL=https://staging.example.com pnpm exec playwright test
```

## Переменные окружения

Приложению для рендера страниц нужны те же env, что и для обычного запуска
(см. `apps/web/env.example`), включая Supabase admin/service-role ключи —
без них API routes и серверные компоненты будут падать с ошибками, и smoke-тесты
не пройдут.
