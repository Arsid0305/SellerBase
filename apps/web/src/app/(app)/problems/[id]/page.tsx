import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { InvestigationBoard } from '@/features/investigations';
import { fetchProblemDetail } from '@/entities/investigations';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export default async function ProblemDetailPage({ params }: Params) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const detail = await fetchProblemDetail(numericId);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Проблема #${detail.problem.id}`}
        description="Дерево расследования: причины → гипотезы → знания"
      />
      <Link
        href="/problems"
        className="inline-flex w-fit items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-3 w-3" /> Назад к списку
      </Link>
      <InvestigationBoard detail={detail} />
    </div>
  );
}
