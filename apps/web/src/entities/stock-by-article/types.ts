// Остатки и оборачиваемость по артикулам на обеих площадках.
//
// Считает база (v_stock_by_article). Здесь только имена полей для страницы.

export type StockByArticleRow = {
  article: string;
  title: string | null;
  /** ВБ, живой склад (ФБО). */
  wbFbo: number;
  /** Ozon, склад площадки (ФБО). */
  ozonFbo: number;
  /** Фулфилмент. Одно число: товар заявляется обеим площадкам одинаково. */
  fbs: number;
  total: number;
  /** Заморожено и зависло - деньги есть, товара в продаже нет. */
  dead: number;
  /** Хватит на дней. null - продаж не было, и это не ноль. */
  daysWb: number | null;
  daysOzon: number | null;
  daysTotal: number | null;
  salesWb28: number;
  salesOzon28: number;
  costPrice: number | null;
};

/** Расхождение заявленного по ФБС между площадками - потерянные продажи. */
export type FbsMismatchRow = {
  article: string;
  title: string | null;
  declaredWb: number;
  declaredOzon: number;
  diff: number;
  state: string;
};
