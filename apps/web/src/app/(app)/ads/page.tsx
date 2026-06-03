import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Реклама товаров' };

export default function AdsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Реклама товаров" description="Рекламные кампании WB и Ozon" />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        Появится после релиза 1
      </div>
    </div>
  );
}
