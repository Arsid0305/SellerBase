# Правила переносимости (Portability Rules)

> **Статус:** обязательно к соблюдению. Эти правила — не рекомендации, а законы проекта.
> Любой PR, нарушающий их, отклоняется.

## Зачем

Фронтенд SellerBase стартует на **Vercel** ради скорости разработки и зрелой
интеграции с Next.js. Но в любой момент мы должны быть в состоянии переехать на
**Yandex Cloud** (Serverless Containers / VM в Docker) или на self-hosted —
без переписывания продукта.

Чтобы такой переезд стоил **1–2 недели одного инженера**, а не **1–2 месяца
команды**, мы с первого дня избегаем vendor lock-in.

## 7 правил

### 1. Никаких Vercel-only SDK

**Запрещено:**
- `@vercel/kv`
- `@vercel/postgres`
- `@vercel/blob`
- `@vercel/edge-config`

**Используем:**
- Кэш / KV → Supabase + Upstash Redis (HTTP API, работает откуда угодно)
- БД → Supabase Postgres
- Файлы → Supabase Storage (см. правило 3)
- Конфиг → env vars + Supabase таблица `app_config`

### 2. Cron — только Supabase / YC Functions

**Запрещено:** Vercel Cron Jobs.

**Используем:** YC Cloud Functions Triggers (уже используется для `sync-sheets`,
`fetch-wb-report`, `fetch-wb-stocks`) или Supabase `pg_cron`.

### 3. Файлы — только Supabase Storage

**Запрещено:** Vercel Blob, AWS S3 напрямую (без абстракции).

**Используем:** Supabase Storage. API S3-совместимый, миграция на YC Object
Storage — замена endpoint + ключей.

### 4. Node runtime по умолчанию, Edge — только осознанно

**Правило:** Server Components, Server Actions, Route Handlers пишем под Node
runtime (по умолчанию). Edge runtime (`export const runtime = 'edge'`) — только
если действительно нужна низкая латентность по гео и код совместим с Edge API.

**Причина:** YC Serverless Containers исполняют Node. Код, написанный под Edge
(нет `Buffer`, нет `fs`, ограниченные npm-пакеты), при переезде сломается.

### 5. Image Optimization через свой loader

**Правило:** `next/image` используем с **custom loader** с первого дня, даже
если внутри он временно делегирует Vercel.

```ts
// src/lib/image-loader.ts
export default function imageLoader({ src, width, quality }: ImageLoaderProps) {
  // Сейчас: Vercel Image Optimization.
  // При переезде: подменяем на Cloudflare Images / YC CDN.
  return `${process.env.NEXT_PUBLIC_IMAGE_CDN}/${src}?w=${width}&q=${quality ?? 75}`;
}
```

```js
// next.config.js
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
  },
};
```

### 6. Dockerfile в репо с первого дня

**Правило:** `Dockerfile` + `.dockerignore` лежат в корне репо и поддерживаются
в рабочем состоянии. Используем Next.js `output: 'standalone'`.

**Проверка:** CI запускает `docker build .` на каждый PR в `main`. Сломан билд
контейнера — PR не мержится.

**Зачем:** переезд на YC = `docker push` в YC Container Registry, а не «давайте
теперь напишем Dockerfile с нуля по горячим следам».

### 7. CI/CD — GitHub Actions, не Vercel Git integration

**Правило:** Источник правды для деплоя — **GitHub Actions**. Vercel Git
integration **выключен**. Деплой на Vercel выполняется из Actions через
`vercel deploy --prebuilt`.

**Зачем:**
- GitHub Actions переносим один-в-один. Шаг `Deploy to Vercel` заменяется на
  `Build Docker image + push to YC Container Registry + update Serverless
  Container` — остальной пайплайн (lint, typecheck, test, build) не меняется
- Один источник правды, одна история запусков, одни секреты

## Чек-лист на каждый PR

- [ ] Не добавлен ни один `@vercel/*` пакет
- [ ] Cron-задачи (если есть) лежат в `yc-functions/` или Supabase `pg_cron`
- [ ] Файлы загружаются через Supabase Storage клиент
- [ ] Новый код не помечен `runtime = 'edge'` без обсуждения
- [ ] Если добавлены изображения — используется `next/image` через наш loader
- [ ] `docker build .` локально проходит
- [ ] Деплой-шаги добавлены в `.github/workflows/`, а не в Vercel UI

## Что мы НЕ запрещаем

Это правила про backend-инфраструктуру. Использовать на фронте можно всё, что
работает на любом Node-хостинге:
- `next/image`, `next/font`, `next/script` — да (через loader для image)
- ISR (`revalidate`), Server Actions, Route Handlers — да
- Streaming, Suspense, PPR — да
- `@vercel/analytics`, `@vercel/speed-insights` — допустимо как доп. слой
  поверх PostHog / Sentry, но **не как единственный** источник метрик

## История решений

- **2026-06-01** — документ создан в момент выбора стека фронтенда
  (Next.js 15 + Vercel) с прицелом на возможный переезд в Yandex Cloud.
