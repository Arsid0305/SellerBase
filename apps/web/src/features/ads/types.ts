export type CampaignType = 'auto' | 'search' | 'card' | 'catalog';
export type CampaignStatus = 'active' | 'paused' | 'archived';
export type AdChannel = 'WB' | 'OZON';

export type AdCampaign = {
  id: string;
  name: string;
  type: CampaignType;
  marketplace: AdChannel;
  status: CampaignStatus;
  dailyBudget: number;
  cpc: number;
  clicks: number;
  clicks14d: number[];
  orders: number;
  conversionRate: number;
  spend: number;
  revenue: number;
  roas: number;
};

export type PromotedProduct = {
  id: string;
  name: string;
  barcode: string;
  channel: AdChannel;
  impressions: number;
  clicks: number;
  orders: number;
  ctr: number;
  cr: number;
  spend: number;
  revenue: number;
  roas: number;
};

export type AdsKpis = {
  budget: number;
  budgetDelta: number;
  cpc: number;
  cpcDelta: number;
  conversionRate: number;
  conversionRateDelta: number;
  roas: number;
  roasDelta: number;
  spendSeries: number[];
  cpcSeries: number[];
  crSeries: number[];
  roasSeries: number[];
};

export const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  auto: 'Автоматическая',
  search: 'Поиск',
  card: 'Карточка товара',
  catalog: 'Каталог',
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  active: 'Активна',
  paused: 'Пауза',
  archived: 'Архив',
};
