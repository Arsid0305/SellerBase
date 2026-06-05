import { PageHeader } from '@/widgets/app-shell/page-header';
import { ProblemsList, ProblemForm } from '@/features/investigations';
import { fetchProblems } from '@/entities/investigations';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const metadata = { title: 'Проблемы' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SkuRow = { id: number; title: string | null; barcode: string | null };

async function fetchSkusLite(): Promise<{ id: number; title: string; barcode: string | null }[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_catalog')
    .select('id, title, barcode')
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(0, 2000);
  if (error) {
    if (error.code === '42P01') return [];
    console.error('[fetchSkusLite]', error);
    return [];
  }
  return (data ?? []).map((s: SkuRow) => ({
    id: s.id,
    title: s.title ?? `SKU #${s.id}`,
    barcode: s.barcode,
  }));
}

export default async function ProblemsPage() {
  const [problems, skus] = await Promise.all([fetchProblems(), fetchSkusLite()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Проблемы"
        description="Что-то идёт не так — фиксируем, расследуем, копим знания"
      />
      <ProblemForm skus={skus} />
      <ProblemsList problems={problems} />
      <p className="text-xs text-muted-foreground">
        · Данные из таблицы `problems`. Цепочка: Проблема → Расследование → Причина → Гипотеза → Знание.
      </p>
    </div>
  );
}
