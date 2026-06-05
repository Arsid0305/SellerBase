import { PageHeader } from '@/widgets/app-shell/page-header';
import { DemoControls, DemoEmptyHint } from '@/widgets/demo-controls';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const metadata = { title: 'Проблемы' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProblemRow = {
  id: number;
  title: string;
  description: string | null;
  severity: string | null;
  status: string | null;
  source: string | null;
};

async function fetchProblems(): Promise<ProblemRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('problems')
    .select('id, title, description, severity, status, source')
    .order('id', { ascending: false })
    .range(0, 500);
  if (error) {
    if (error.code === '42P01') return [];
    console.error('[fetchProblems]', error);
    return [];
  }
  return (data ?? []) as ProblemRow[];
}

export default async function ProblemsPage() {
  const problems = await fetchProblems();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Проблемы"
          description="Что мешает: гипотезы и подтверждённые проблемы с серьёзностью"
        />
        <DemoControls scope="problems" />
      </div>
      {problems.length === 0 ? (
        <DemoEmptyHint scope="problems" />
      ) : (
        <ul className="flex flex-col gap-2">
          {problems.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">{p.title}</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                    {p.severity ?? '—'}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                    {p.status ?? '—'}
                  </span>
                  {p.source === 'demo' ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                      demo
                    </span>
                  ) : null}
                </div>
              </div>
              {p.description ? (
                <span className="text-xs text-neutral-500">{p.description}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
