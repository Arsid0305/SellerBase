import { PageHeader } from '@/widgets/app-shell/page-header';
import { SupplyCalculator } from '@/features/supply-calculator/supply-calculator';

export const metadata = { title: 'Калькулятор поставки' };
export const dynamic = 'force-dynamic';

export default function CalculatorPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Калькулятор поставки"
        description="Сколько везти по каждому товару. Считается по скорости продаж и остатку — подвиньте сроки, цифры пересчитаются"
      />
      <SupplyCalculator />
    </div>
  );
}
