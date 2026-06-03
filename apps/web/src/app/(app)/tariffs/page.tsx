import { PageHeader } from '@/widgets/app-shell/page-header';
import { TariffsExplorer } from '@/features/tariffs';

export const metadata = { title: 'Тарифы и коэффициенты' };

export default function TariffsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Тарифы и коэффициенты"
        description="Актуальные тарифы WB/Ozon, ваши персональные индексы и история изменений"
      />
      <TariffsExplorer />
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальные тарифы из WB/Ozon API подтянутся в следующих PR.
      </p>
    </div>
  );
}
