import { Activity, TrendingDown, ShieldCheck } from 'lucide-react';
import { CategoryCard, StatList } from '@/shared/ui/domain/category-card';
import { formatDate } from '@/shared/lib/format';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { PersonalIndicesForm } from './personal-indices-form';

type PersonalIndicesRow = {
  week_start: string;
  localization_index: number | null;
  sales_distribution_index: number | null;
  fbo_reliability_pct: number | null;
  note: string | null;
  created_at: string;
};

async function fetchLatest(): Promise<PersonalIndicesRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.rpc('get_latest_personal_indices');
  const rows = (data ?? []) as PersonalIndicesRow[];
  return rows[0] ?? null;
}

export async function PersonalIndicesSection() {
  const latest = await fetchLatest();
  const empty = !latest;
  const updated = latest ? formatDate(latest.week_start) : '—';
  const localization = latest?.localization_index ?? null;
  const distribution = latest?.sales_distribution_index ?? null;
  const reliability = latest?.fbo_reliability_pct ?? null;

  const locTone = localization != null && localization >= 1 ? 'positive' : localization != null ? 'negative' : 'muted';
  const distTone = distribution != null && distribution <= 1 ? 'positive' : distribution != null ? 'negative' : 'muted';
  const relTone = reliability != null && reliability >= 90 ? 'positive' : reliability != null ? 'negative' : 'muted';

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        ℹ️ Индексы локализации и распределения WB не отдаёт через API — заполняй руками раз в неделю (пн после 06:00 МСК) по данным из ЛК.
        {empty && ' Пока записей нет — заполни форму ниже.'}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CategoryCard title="Индекс локализации" tone="emerald" icon={Activity}>
          <StatList
            rows={[
              { label: 'Текущее значение', value: localization != null ? localization.toFixed(2) : '—', tone: locTone, hint: 'эффективность распределения остатков между складами' },
              { label: 'Неделя', value: updated, tone: 'muted' },
            ]}
          />
        </CategoryCard>
        <CategoryCard title="Индекс распределения продаж" tone="amber" icon={TrendingDown}>
          <StatList
            rows={[
              { label: 'Текущее значение', value: distribution != null ? distribution.toFixed(2) : '—', tone: distTone, hint: 'доля наценки от логистики между регионами' },
              { label: 'Неделя', value: updated, tone: 'muted' },
            ]}
          />
        </CategoryCard>
        <CategoryCard title="Надёжность FBO" tone="emerald" icon={ShieldCheck}>
          <StatList
            rows={[
              { label: 'Значение', value: reliability != null ? `${reliability.toFixed(1)}%` : '—', tone: relTone },
              { label: 'Неделя', value: updated, tone: 'muted' },
            ]}
          />
        </CategoryCard>
      </div>
      <PersonalIndicesForm latest={latest} />
    </div>
  );
}
