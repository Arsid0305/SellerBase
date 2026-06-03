export type ReviewSentiment = 'positive' | 'neutral' | 'negative';
export type ReviewResponseStatus = 'answered' | 'pending' | 'ignored';

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export interface Review {
  id: string;
  productName: string;
  productBarcode: string;
  channel: 'WB' | 'OZON';
  rating: ReviewRating;
  text: string;
  author: string;
  date: string;
  sentiment: ReviewSentiment;
  responseStatus: ReviewResponseStatus;
  responseText?: string;
  responseDate?: string;
}

export interface ReviewsSummary {
  totalReviews: number;
  avgRating: number;
  avgRatingDelta: number;
  positiveShare: number;
  negativeShare: number;
  responseRate: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
}
