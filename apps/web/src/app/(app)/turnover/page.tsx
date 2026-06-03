import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Оборачиваемость' };

export default function TurnoverPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Оборачиваемость"
        description="Сегменты стабильности продаж и деньги в товаре"
      />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        M5 · 4 сегмента (Стабильная / Средняя / Нестабильная) + динамика · скоро
      </div>
    </div>
  );
}
