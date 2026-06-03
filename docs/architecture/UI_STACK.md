# UI Stack — SellerBase Frontend

> **Статус:** обязательно к соблюдению. Документ фиксирует технологические выборы,
> на которые опирается весь фронтенд. Замена любой позиции в списке —
> только через отдельный архитектурный PR с обоснованием.

## Контекст

SellerBase — SaaS для селлеров маркетплейсов (Wildberries, Ozon, далее Я.Маркет и др.).
Продукт data-heavy: десятки дашбордов, тяжёлые таблицы (10k+ SKU), сравнение
периодов, ABC×XYZ матрицы, графики, экспорт. Эталоны индустрии — InSales
Analytics, MP Profit, SellerStats.

Стек выбирался под три фундаментальных требования:
1. **Масштабируемость** на годы — десятки модулей, FSD-структура, типобезопасность end-to-end
2. **Production-grade** инструменты, на которых сидят реальные команды (Linear, Cal.com, Resend, Vercel)
3. **Portability** — возможность переезда с Vercel на Yandex Cloud по правилам `PORTABILITY.md`

## Финальный выбор

### Ядро

| Слой | Решение | Версия | Альтернативы (рассматривались) |
|---|---|---|---|
| Менеджер пакетов | **pnpm** | 9.x+ | npm, yarn — отказ: медленнее, дороже по диску |
| Фреймворк | **Next.js (App Router)** | 15.x | Vite SPA — отказ: упрётся в SPA-лимит. TanStack Start — отказ: молодая экосистема |
| React | **React** | 19.x | — |
| Язык | **TypeScript (strict)** | 5.x | — с флагами `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` |
| Стилизация | **Tailwind CSS** | 4.x | CSS Modules, styled-components — отказ: проигрывают по DX и tree-shaking |

### UI-кит

| Слой | Решение | Альтернативы (отвергнуты) |
|---|---|---|
| Компоненты | **shadcn/ui** (поверх Radix UI) | Mantine, Ant Design — отказ: чужой CSS, тяжело брендировать матрицы/KPI, всё равно нужен TanStack Table сверху |
| Иконки | **lucide-react** | — |
| Анимации | **framer-motion** | — |

**Принцип:** код shadcn-компонентов лежит в нашем репо (`src/shared/ui/`). Все
доменные компоненты (KpiCard, AbcXyzMatrix, PeriodComparePicker, DataTablePro,
MarketplaceFilter, ProductTagBadge, DrilldownSheet) строятся поверх примитивов
Radix без борьбы с чужой CSS-специфичностью.

### Данные и таблицы

| Слой | Решение | Зачем |
|---|---|---|
| Серверное состояние | **@tanstack/react-query** v5 | Кэш, инвалидация, оптимистические апдейты, retry |
| Клиентское состояние | **zustand** | Легче Redux, типизированный, минимум бойлерплейта |
| Таблицы (headless) | **@tanstack/react-table** v8 | Единственный, кто закрывает: virtualization, resize/reorder колонок, presets, server-side, expandable, footer aggregates |
| Виртуализация | **@tanstack/react-virtual** | Для таблиц 10k+ строк |
| URL state | **nuqs** | Период/фильтры в URL → шеринг отчётов между сотрудниками |

### Графики

| Слой | Решение | Использование |
|---|---|---|
| KPI-карточки, простые графики | **Tremor** | Area / Bar / Line / Donut / Sparkline (Tailwind-native, совместим с shadcn) |
| Кастомные графики | **Recharts** | Dual-axis, нестандартные комбинации |
| Heatmap | **@nivo/heatmap** | Позиции по запросам/датам |

### Формы и валидация

| Слой | Решение |
|---|---|
| Формы | **react-hook-form** |
| Валидация (рантайм + типы) | **zod** + **@hookform/resolvers/zod** |
| Server Actions с типами | **next-safe-action** (или server actions + zod вручную) |

**Принцип:** zod-схемы используются на ВСЕХ границах — формы, API-ответы,
env vars, Supabase responses. Никакого `any`-болота через год.

### Backend-клиент

| Слой | Решение | Зачем |
|---|---|---|
| Supabase | **@supabase/supabase-js** v2 + **@supabase/ssr** | DB + Auth + Storage |
| Типы из БД | **supabase gen types typescript** | End-to-end типизация от Postgres до UI |

### Качество кода

| Слой | Решение |
|---|---|
| Линтер | ESLint (flat config) с `@typescript-eslint`, `eslint-plugin-react`, `eslint-config-next` |
| Форматтер | Prettier + `prettier-plugin-tailwindcss` |
| Pre-commit | Husky + lint-staged |
| Тесты (unit) | **Vitest** + `@testing-library/react` |
| Тесты (e2e) | **Playwright** |
| Типы | `tsc --noEmit` в CI |

### Observability

| Слой | Решение |
|---|---|
| Ошибки | **Sentry** (`@sentry/nextjs`) с первого дня |
| Продуктовая аналитика | **PostHog** (self-hosted-ready) |
| Web Vitals | Vercel Speed Insights — допустим, но дублируем в PostHog |

### Утилиты

| Назначение | Решение |
|---|---|
| Даты | **date-fns** (tree-shakeable, без moment) |
| Excel/CSV экспорт | **xlsx** + **papaparse** |
| HTTP вне Supabase | встроенный `fetch` (Next 15 кэширует) |

## Доменные компоненты (пишем сами)

Этот список — мини-дизайн-система SellerBase. Эти 7 компонентов закрывают 80%
повторяющейся работы и переиспользуются на всех модулях:

1. **`<KpiCard>`** — значение + дельта% + стрелка ↑/↓ + sparkline + tooltip сравнения периодов
2. **`<PeriodComparePicker>`** — двойной range «Текущий vs Сравнение» с пресетами и авто-расчётом «прошлый аналогичный период»
3. **`<DataTablePro>`** — обёртка TanStack Table со встроенными: presets колонок, экспорт, bulk-actions footer, virtualization, sticky первой колонки
4. **`<AbcXyzMatrix>`** — 2D-grid 4×3 (или N×M) с цветовыми зонами, hover-tooltip, drill-down кликом
5. **`<MarketplaceFilter>`** — мульти-селект WB/Ozon/Я.Маркет/МегаМаркет с брендовыми иконками
6. **`<ProductTagBadge>`** — пресет цветов под PPP/A/B/C/X/Y/Z/FBO/FBS
7. **`<DrilldownSheet>`** — боковая панель карточки товара с табами (Сводка/По дням/По неделям/Запросы)

Лежат в `src/shared/ui/domain/`, документируются в Storybook (опц., поздний этап).

## Запреты

- ❌ Никаких `@vercel/*` SDK кроме `@vercel/analytics` (см. PORTABILITY.md)
- ❌ Никаких CSS-in-JS либ кроме Tailwind (styled-components, emotion, vanilla-extract)
- ❌ Никакого Material UI / Chakra / Bootstrap — несовместимы с Tailwind-токенами
- ❌ Никакого Redux Toolkit — zustand покрывает 100% потребностей легче
- ❌ Никакого moment.js / dayjs — только date-fns
- ❌ Никакого jQuery, lodash целиком — только точечные импорты (`lodash-es/{fn}`) если без них никак

## История решений

- **2026-06-01** — стек выбран в момент старта проекта на основе аудита 3 конкурентов
  (InSales, MP Profit, SellerStats) и существующих наработок (`design-system/kino-app`).
