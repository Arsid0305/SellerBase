import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Источники заказов' };

export default function SourcesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Источники заказов" description="Каналы продаж и их вклад" />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        Появится после релиза 1
      </div>
    </div>
  );
}
