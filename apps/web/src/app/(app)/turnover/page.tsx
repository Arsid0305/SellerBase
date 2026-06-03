import { PageHeader } from '@/widgets/app-shell/page-header';
import {
  TurnoverExplorer,
  TurnoverDynamicsChart,
  turnoverSegments,
  turnoverDynamics,
  mockTurnoverProducts,
} from '@/features/turnover';

export const metadata = { title: 'Оборачиваемость' };

export default function TurnoverPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Оборачиваемость"
        description="Сегменты стабильности продаж и «деньги в товаре»"
      />
      <TurnoverDynamicsChart data={turnoverDynamics} />
      <TurnoverExplorer segments={turnoverSegments} products={mockTurnoverProducts} />
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальная VIEW `v_turnover` подключится в следующем PR.
      </p>
    </div>
  );
}
