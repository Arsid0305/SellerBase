import { PageHeader } from '@/widgets/app-shell/page-header';
import { ReviewsExplorer, mockReviews } from '@/features/reviews';

export const metadata = { title: 'Отзывы и оценки' };

export default function ReviewsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Отзывы и оценки"
          description="Рейтинг товаров, тексты отзывов, скорость ответа"
        />
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
          ⚠ Демо-данные
        </span>
      </div>
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        Показаны демонстрационные данные из фикстуры. Реальная интеграция с WB Feedback API ещё не подключена — поэтому средний рейтинг, доли и скорость ответа не отражают реальную картину.
      </div>
      <ReviewsExplorer rows={mockReviews} />
    </div>
  );
}
