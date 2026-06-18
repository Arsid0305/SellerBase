/**
 * Единый источник правды для бизнес-параметров (налоги, эквайринг, пороги).
 * Раньше эти константы были разбросаны: налог 7% в margin-analyzer, 6% в price-simulator, БД в pnl.
 * Все новые расчёты должны импортировать отсюда.
 */

/** УСН доходы — 6%. */
export const TAX_PCT = 0.06;

/** Эквайринг (карты/SBP) — ~1.5%. */
export const ACQUIRING_PCT = 0.015;

/** Пороги маржи в долях (0-1) для классификации SKU. */
export const MARGIN_THRESHOLDS = {
  loss: 0,
  low: 0.15,
  ok: 0.25,
  high: 0.3,
} as const;

/** Пороги маржи в процентах (0-100) — для UI и устаревших расчётов. */
export const MARGIN_THRESHOLDS_PCT = {
  loss: 0,
  low: 15,
  ok: 25,
  high: 30,
} as const;

/** Пороги по «хватит дней» (daysOfStock / turnoverDays). */
export const STOCK_DAYS_THRESHOLDS = {
  critical: 7,
  ok: 14,
  excess: 90,
  overstock: 180,
} as const;

/** Окна расчётов (в днях). */
export const WINDOWS = {
  /** Стандартное окно отчётности — 30 дней. */
  standard: 30,
  /** Воронка WB-кабинета — 30 дней (совпадает с UI WB). */
  funnelAggregate: 30,
  /** Окно средней цены для прогноза упущенной выручки в /deficit. */
  deficitAvgPrice: 90,
  /** Горизонт прогноза упущенной выручки. */
  deficitForecast: 14,
  /** Окно расчёта оборачиваемости — 28 дней. */
  turnover: 28,
} as const;

/** Пороги ABC-классификации (доля кумулятивной выручки). */
export const ABC_THRESHOLDS = {
  /** A: топ-80% выручки. */
  a: 0.8,
  /** B: 80-95%. */
  b: 0.95,
} as const;

/** Пороги «оборачиваемость / акция полезна». */
export const TURNOVER_PROMO = {
  /** Дни, при которых стоит запустить акцию. */
  promoBenefit: 60,
  /** Срочно сливать (избыток). */
  urgentSell: 90,
  /** Минимальная маржа промо для рекомендации. */
  minPromoMargin: 0.1,
} as const;

/** Конфигурация супплай-плана. */
export const SUPPLY_PLAN = {
  /** Целевое покрытие дней при заказе. */
  targetDays: 30,
  /** Окно расчёта средних продаж для прогноза. */
  salesWindow: 60,
} as const;
