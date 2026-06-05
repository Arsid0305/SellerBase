export type EventKind =
  | 'PRICE_UP'
  | 'PRICE_DOWN'
  | 'SALES_SPIKE'
  | 'SALES_DROP'
  | 'STOCK_OUT'
  | 'STOCK_LOW'
  | 'NO_SALES';

export type EventSeverity = 'info' | 'warn' | 'critical';

export type ProductEvent = {
  date: string;
  kind: EventKind;
  severity: EventSeverity;
  title: string;
  detail: string;
};

export const EVENT_META: Record<EventKind, { label: string; severity: EventSeverity }> = {
  PRICE_UP: { label: 'Цена выросла', severity: 'info' },
  PRICE_DOWN: { label: 'Цена снизилась', severity: 'info' },
  SALES_SPIKE: { label: 'Резкий рост продаж', severity: 'info' },
  SALES_DROP: { label: 'Резкий спад продаж', severity: 'warn' },
  STOCK_OUT: { label: 'Закончился остаток', severity: 'critical' },
  STOCK_LOW: { label: 'Остатки < 7 дней', severity: 'warn' },
  NO_SALES: { label: 'Нет продаж > 7 дней', severity: 'warn' },
};
