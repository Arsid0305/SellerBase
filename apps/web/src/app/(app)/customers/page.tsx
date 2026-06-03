import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Клиенты' };

export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Клиенты" description="База покупателей и RFM-анализ" />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        Появится после релиза 1
      </div>
    </div>
  );
}
