import { Activity, Star, ShieldCheck } from 'lucide-react';
import { CategoryCard, StatList } from '@/shared/ui/domain/category-card';
import { formatDate } from '@/shared/lib/format';
import { mockPersonalIndices } from './mock-data';

export function PersonalIndicesSection() {
  const p = mockPersonalIndices;
  const updated = formatDate(p.updatedAt);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <CategoryCard title="Индекс локализации" tone="emerald" icon={Activity}>
        <StatList
          rows={[
            {
              label: 'Текущее значение',
              value: `+${p.localizationIndex}%`,
              tone: 'positive',
              hint: 'выше среднего по нише',
            },
            { label: 'Обновлено', value: updated, tone: 'muted' },
          ]}
        />
      </CategoryCard>
      <CategoryCard title="Рейтинг продавца" tone="emerald" icon={Star}>
        <StatList
          rows={[
            { label: 'Оценка', value: `${p.ratingScore.toFixed(1)} ★`, tone: 'positive' },
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
  );
}
