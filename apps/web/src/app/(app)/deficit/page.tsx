import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Дефицит товаров' };

export default function DeficitPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Дефицит товаров"
        description="Что заканчивается и сколько денег теряется на упущенных продажах"
      />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        M3 · Таблица дефицита с «Хватит на N дней» и упущенной выручкой · скоро
      </div>
    </div>
  );
}
