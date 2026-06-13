export type PromoSummary = {
  promotionId: number;
  name: string;
  type: string | null;
  startAt: string;
  endAt: string;
  skuCount: number;
  participatingCount: number;
  pendingCount: number;
  avgTurnoverDays: number | null;
};

export type PromoSkuRow = {
  promotionId: number;
  nmId: number;
  myArticle: string | null;
  title: string | null;
  brand: string | null;
  subjectName: string | null;
  barcode: string | null;
  stockUnits: number;
  turnoverDays: number | null;
  currentPrice: number | null;
  currentDiscount: number | null;
  planPrice: number | null;
  planDiscount: number | null;
  marginCurrentPct: number | null;
  marginPromoPct: number | null;
  marginCurrentRub: number | null;
  marginPromoRub: number | null;
  recommended: boolean;
  userParticipate: boolean | null;
  userNote: string | null;
};
