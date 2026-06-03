import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Поиск ниши Ozon' };

export default function NichePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Поиск ниши Ozon" description="Внешняя аналитика рынка" />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        Появится после релиза 1
      </div>
    </div>
  );
}
