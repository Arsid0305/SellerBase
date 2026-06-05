import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PersonaForm, PersonaScenariosCard } from '@/features/customer';
import {
  fetchPersona,
  fetchScenarios,
  GENDER_LABEL,
  INCOME_LABEL,
} from '@/entities/customer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const persona = await fetchPersona(Number(id));
  return { title: persona?.name ?? 'Персона' };
}

export default async function PersonaDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) notFound();
  const [persona, allScenarios] = await Promise.all([fetchPersona(numId), fetchScenarios()]);
  if (!persona) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/customers" className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="size-4" />
          Покупатели
        </Link>
        <span>·</span>
        <span className="truncate font-medium text-foreground">{persona.name}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{persona.name}</h1>
          {persona.description ? (
            <p className="max-w-2xl text-sm text-neutral-600">{persona.description}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-neutral-900">Профиль</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-neutral-500">Возраст от</dt>
            <dd className="text-neutral-800">{persona.ageMin ?? '—'}</dd>
            <dt className="text-neutral-500">Возраст до</dt>
            <dd className="text-neutral-800">{persona.ageMax ?? '—'}</dd>
            <dt className="text-neutral-500">Пол</dt>
            <dd className="text-neutral-800">
              {persona.gender ? GENDER_LABEL[persona.gender] : '—'}
            </dd>
            <dt className="text-neutral-500">Доход</dt>
            <dd className="text-neutral-800">
              {persona.incomeLevel ? INCOME_LABEL[persona.incomeLevel] : '—'}
            </dd>
          </dl>
        </section>
        <PersonaForm initial={persona} mode="edit" />
      </div>

      <PersonaScenariosCard persona={persona} allScenarios={allScenarios} />
    </div>
  );
}
