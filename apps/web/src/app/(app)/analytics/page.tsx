import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Товарная аналитика' };

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Товарная аналитика"
        description="ABC × XYZ матрица, прибыльность товаров, тренды"
      />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        M4 · ABC × XYZ матрица 4×3 + таблица товаров · скоро
      </div>
    </div>
  );
}
