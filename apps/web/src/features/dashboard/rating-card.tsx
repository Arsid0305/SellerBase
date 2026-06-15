import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card';
import type { SellerAnalytics } from '@/entities/seller-analytics';

type RatingProps = { rating: SellerAnalytics['rating'] };

export function RatingCard({ rating }: RatingProps) {
  const avg = rating.avgRating;
  const display = avg == null ? '—' : avg.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

  return (
    <Card className="p-4">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="text-sm font-medium">Оценка товара</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Средний рейтинг</span>
            <span className="inline-flex items-baseline gap-1 text-lg font-semibold tabular-nums">
              <span aria-hidden>⭐</span>
              <span>{display}</span>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">SKU с рейтингом</span>
            <span className="text-lg font-semibold tabular-nums">{rating.skusWithRating}</span>
          </div>
        </div>
        {avg == null && (
          <p className="mt-3 text-xs text-muted-foreground">Скоро (fetch-wb-content)</p>
        )}
      </CardContent>
    </Card>
  );
}
