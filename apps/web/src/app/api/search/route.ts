import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ProductHit = { id: string | number; barcode: string; title: string; brand: string | null };
type GoalHit = { id: string | number; title: string };
type TaskHit = { id: string | number; title: string };

const MISSING_TABLE = '42P01';

function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (q.length < 2) {
    return NextResponse.json({ products: [], goals: [], tasks: [] });
  }

  const supabase = createAdminClient();
  const like = `%${escapeIlike(q)}%`;

  const productsP = supabase
    .from('sku_catalog')
    .select('id, barcode, title, brand')
    .or(`title.ilike.${like},barcode.ilike.${like}`)
    .limit(10);

  const goalsP = supabase.from('goals').select('id, title').ilike('title', like).limit(10);

  const tasksP = supabase.from('tasks').select('id, title').ilike('title', like).limit(10);

  const [productsRes, goalsRes, tasksRes] = await Promise.all([productsP, goalsP, tasksP]);

  const products: ProductHit[] = productsRes.error ? [] : ((productsRes.data ?? []) as ProductHit[]);

  let goals: GoalHit[] = [];
  if (!goalsRes.error) {
    goals = (goalsRes.data ?? []) as GoalHit[];
  } else if (goalsRes.error.code && goalsRes.error.code !== MISSING_TABLE) {
    goals = [];
  }

  let tasks: TaskHit[] = [];
  if (!tasksRes.error) {
    tasks = (tasksRes.data ?? []) as TaskHit[];
  } else if (tasksRes.error.code && tasksRes.error.code !== MISSING_TABLE) {
    tasks = [];
  }

  return NextResponse.json({ products, goals, tasks });
}
