import { PageHeader } from '@/widgets/app-shell/page-header';
import { ReviewsExplorer, mockReviews } from '@/features/reviews';
import { fetchReviews } from '@/entities/reviews';

export const metadata = { title: 'Отзывы и оценки' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReviewsPage() {
  const real = await fetchReviews(500);
  const usingReal = real.length > 0;
  const rows = usingReal ? real : mockReviews;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Отзывы и оценки"
          description="Рейтинг товаров, тексты отзывов, скорость ответа"
        />
        {!usingReal && (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            ⚠ Демо-данные
          </span>
        )}
      </div>
      {!usingReal && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Показаны демонстрационные данные. Реальные отзывы появятся после первого запуска <code>fetch-wb-feedback</code> (cron 05:30 МСК).
        </div>
      )}
      <ReviewsExplorer rows={rows} />
    </div>
  );
}
