import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Прибыль и убытки' };

export default function PnLPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Прибыль и убытки"
        description="Реальная прибыль с учётом комиссий, логистики, рекламы и себестоимости"
      />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        M2 · Dual-line chart + P&L таблица по статьям · скоро
      </div>
    </div>
  );
}
