import { PageHeader } from '@/widgets/app-shell/page-header';
import { ReviewsExplorer, mockReviews } from '@/features/reviews';

export const metadata = { title: 'Отзывы и оценки' };

export default function ReviewsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Отзывы и оценки"
        description="Рейтинг товаров, тексты отзывов, скорость ответа"
      />
      <ReviewsExplorer rows={mockReviews} />
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальные отзывы из WB/Ozon API + интеграция бота-ответчика подключатся в следующих PR.
      </p>
    </div>
  );
}
