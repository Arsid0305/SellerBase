export type NicheCategory = {
  id: string;
  name: string;
  sellersCount: number;
  productsCount: number;
  monthlyRevenue: number;
  avgPrice: number;
  topBrandShare: number;
  competitiveness: number;
  trend30d: number[];
};

export type NicheBrand = {
  id: string;
  name: string;
  productsCount: number;
  monthlyRevenue: number;
  avgRating: number;
  topCategory: string;
  marketShare: number;
};

export type SearchQuery = {
  id: string;
  text: string;
  frequency: number;
  competitorCount: number;
  avgCpc: number;
  trend7d: number[];
};

export type NicheKpis = {
  categoriesCount: number;
  brandsCount: number;
  productsCount: number;
  avgCategoryRevenue: number;
};
