import { Activity, TrendingDown, ShieldCheck } from 'lucide-react';
import { CategoryCard, StatList } from '@/shared/ui/domain/category-card';
import { formatDate } from '@/shared/lib/format';
import { mockPersonalIndices } from './mock-data';

export function PersonalIndicesSection() {
  const p = mockPersonalIndices;
  const updated = formatDate(p.updatedAt);

  const localizationTone = p.localizationIndex >= 1 ? 'positive' : 'negative';
  const distributionTone = p.salesDistributionIndex <= 1 ? 'positive' : 'negative';

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        ⚠ Личные индексы — демо-значения. Реальные индексы локализации и распределения WB пока не интегрированы (нет публичного API).
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <CategoryCard title="Индекс локализации" tone="emerald" icon={Activity}>
        <StatList
          rows={[
            {
              label: 'Текущее значение',
              value: p.localizationIndex.toFixed(2),
              tone: localizationTone,
              hint: 'эффективность распределения остатков между складами',
            },
            { label: 'Обновлено', value: updated, tone: 'muted' },
          ]}
        />
      </CategoryCard>
      <CategoryCard title="Индекс распределения продаж" tone="amber" icon={TrendingDown}>
        <StatList
          rows={[
            {
              label: 'Текущее значение',
              value: `${p.salesDistributionIndex.toFixed(2)}%`,
              tone: distributionTone,
              hint: '% от розничной цены — доп. стоимость логистики',
            },
            { label: 'Обновлено', value: updated, tone: 'muted' },
          ]}
        />
      </CategoryCard>
      <CategoryCard title="Compliance" tone="emerald" icon={ShieldCheck}>
        <StatList
          rows={[
            { label: 'Соответствие требованиям', value: `${p.complianceScore}%`, tone: 'positive' },
            { label: 'Обновлено', value: updated, tone: 'muted' },
          ]}
        />
      </CategoryCard>
      </div>
    </div>
  );
}
