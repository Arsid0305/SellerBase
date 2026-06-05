/**
 * Жизненный цикл товара — из VISION.md (архитектурная визия).
 *
 * NEW — новый, в каталоге меньше 14 дней или < 7 дней с продажами
 * GROWING — выручка текущих 14 дней > предыдущих 14 дней на ≥ 20%
 * STABLE — выручка колеблется в пределах ±20%
 * DECLINING — выручка упала на ≥ 20%, но продажи ещё есть
 * CRITICAL — остаток 0 и ожидаемая упущенная выручка > 0, или нет продаж > 14 дней при стоке
 * LEADER — входит в топ-N по выручке И маржа ≥ 25% И стабильно/растёт
 * ARCHIVED — is_active = false в каталоге
 */
export type ProductLifecycleState =
  | 'NEW'
  | 'GROWING'
  | 'STABLE'
  | 'DECLINING'
  | 'CRITICAL'
  | 'LEADER'
  | 'ARCHIVED';

/** Вход для классификатора — всё, что нужно для определения состояния. */
export type LifecycleInput = {
  isActive: boolean;
  daysInCatalog: number;
  daysSinceLastSale: number;
  revenue14d: number; // текущие 14 дней
  revenue14dPrev: number; // предыдущие 14 дней
  marginPct: number;
  stock: number;
  unitsPerDay: number;
  isTopRevenue: boolean; // входит ли в топ-N по выручке в каталоге
};

export type LifecycleMeta = {
  label: string;
  tone: 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'neutral';
  description: string;
};

export const LIFECYCLE_META: Record<ProductLifecycleState, LifecycleMeta> = {
  NEW: {
    label: 'Новый',
    tone: 'sky',
    description: 'Свежий товар — в каталоге меньше 14 дней или мало истории продаж',
  },
  GROWING: {
    label: 'Растёт',
    tone: 'emerald',
    description: 'Выручка текущих 14д выше предыдущих на ≥0&nbsp;20%',
  },
  STABLE: {
    label: 'Стабильный',
    tone: 'neutral',
    description: 'Выручка колеблется в пределах ±20% между периодами',
  },
  DECLINING: {
    label: 'Падает',
    tone: 'amber',
    description: 'Выручка упала на ≥20% при сохранённых продажах',
  },
  CRITICAL: {
    label: 'Критичный',
    tone: 'rose',
    description: 'Нет остатков и есть спрос, или нет продаж > 14 дней при стоке',
  },
  LEADER: {
    label: 'Лидер',
    tone: 'violet',
    description: 'Входит в топ-N по выручке с маржей ≥25% и стабильным спросом',
  },
  ARCHIVED: {
    label: 'Архив',
    tone: 'neutral',
    description: 'Товар выведен из оборота',
  },
};
