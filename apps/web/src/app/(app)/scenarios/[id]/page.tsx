import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { ScenarioForm, ScenarioDetailCard } from '@/features/customer';
import { fetchScenario, LEVEL_LABEL, type Level3 } from '@/entities/customer';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { Persona } from '@/entities/customer';
import type { ScenarioDetailSkuRef } from '@/features/customer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ id: string }>;

const LEVEL_TONE: Record<Level3, string> = {
  low: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  med: 'border-sky-200 bg-sky-50 text-sky-700',
  high: 'border-rose-200 bg-rose-50 text-rose-700',
};

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const scenario = await fetchScenario(Number(id));
  return { title: scenario?.title ?? 'Сценарий' };
}

async function fetchAllPersonas(): Promise<Persona[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_personas')
    .select('id, name, description, age_min, age_max, gender, income_level, notes, created_at, updated_at')
    .order('id', { ascending: false })
    .range(0, 2000);
  if (error) return [];
  type Row = {
    id: number;
    name: string;
    description: string | null;
    age_min: number | null;
    age_max: number | null;
    gender: string | null;
    income_level: string | null;
    notes: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
  };
  return (data ?? []).map((r) => {
    const row = r as Row;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      ageMin: row.age_min,
      ageMax: row.age_max,
      gender: row.gender as Persona['gender'],
      incomeLevel: row.income_level as Persona['incomeLevel'],
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

async function fetchAllSkus(): Promise<ScenarioDetailSkuRef[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_catalog')
    .select('id, title, barcode')
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(0, 2000);
  if (error) return [];
  type Row = { id: number; title: string | null; barcode: string | null };
  return (data ?? []).map((r) => {
    const row = r as Row;
    return { id: row.id, title: row.title ?? `SKU #${row.id}`, barcode: row.barcode };
  });
}

export default async function ScenarioDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) notFound();
  const [scenario, personas, skus] = await Promise.all([
    fetchScenario(numId),
    fetchAllPersonas(),
    fetchAllSkus(),
  ]);
  if (!scenario) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/customers" className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="size-4" />
          Покупатели
        </Link>
        <span>·</span>
        <span className="truncate font-medium text-foreground">{scenario.title}</span>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{scenario.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={LEVEL_TONE[scenario.urgency]}>
            Срочность: {LEVEL_LABEL[scenario.urgency]}
          </Badge>
          <Badge variant="outline" className={LEVEL_TONE[scenario.priceSensitivity]}>
            Цена: {LEVEL_LABEL[scenario.priceSensitivity]}
          </Badge>
          {scenario.trigger ? (
            <span className="text-xs text-neutral-500">
              Триггер: <span className="text-neutral-700">{scenario.trigger}</span>
            </span>
          ) : null}
        </div>
        {scenario.description ? (
          <p className="max-w-2xl text-sm text-neutral-600">{scenario.description}</p>
        ) : null}
      </div>

      <ScenarioForm initial={scenario} mode="edit" />

      <ScenarioDetailCard scenario={scenario} allPersonas={personas} allSkus={skus} />
    </div>
  );
}
