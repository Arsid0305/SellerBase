/** Товар Ozon: цена, что заберёт площадка и что останется. */
export interface OzonPriceRow {
  article: string;
  title: string | null;
  price: number;
  commissionPct: number | null;
  commissionRub: number | null;
  logistics: number | null;
  delivery: number | null;
  acquiring: number | null;
  takesOzon: number | null;
  left: number | null;
  costPrice: number | null;
  profit: number | null;
  marginPct: number | null;
  indexColor: string | null;
}

/** Товар, у которого с ценой беда, и в чём именно. */
export interface OzonPriceProblemRow {
  article: string;
  title: string | null;
  price: number;
  costPrice: number | null;
  profit: number | null;
  marginPct: number | null;
  indexColor: string | null;
  problem: string | null;
}

/** Акция Ozon. */
export interface OzonActionRow {
  actionId: number;
  title: string | null;
  kind: string | null;
  participating: boolean | null;
  productsIn: number | null;
  productsCould: number | null;
  endsAt: string | null;
}

/** Цена против продвижения: обе прибыли рядом. */
export interface OzonBoostRow {
  action: string | null;
  article: string;
  title: string | null;
  priceNoAction: number | null;
  actionPrice: number | null;
  priceForMaxBoost: number | null;
  boostNow: number | null;
  boostMax: number | null;
  profitNow: number | null;
  profitAtMaxBoost: number | null;
  lossPerUnit: number | null;
}
