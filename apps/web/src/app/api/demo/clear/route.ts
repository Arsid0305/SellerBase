import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Scope = 'all' | 'goals' | 'tasks' | 'problems' | 'customers';
const ALL_SCOPES: Scope[] = ['goals', 'tasks', 'problems', 'customers'];

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function clearTable(supabase: SupabaseAdmin, table: string): Promise<number> {
  // Two-step: select demo ids to count, then delete by ids. Avoids relying on .delete().select() return shape.
  const { data, error: selectError } = await supabase
    .from(table)
    .select('id')
    .eq('source', 'demo');
  if (selectError) {
    if (selectError.code === '42P01' || selectError.code === '42703') return 0;
    console.error(`[demo/clear ${table}] select`, selectError);
    return 0;
  }
  const ids = (data ?? []).map((r: { id: number | string }) => r.id);
  if (ids.length === 0) return 0;
  const { error: delError } = await supabase.from(table).delete().in('id', ids);
  if (delError) {
    console.error(`[demo/clear ${table}] delete`, delError);
    return 0;
  }
  return ids.length;
}

export async function DELETE(req: Request) {
  let body: { scope?: Scope } = {};
  try {
    body = (await req.json()) as { scope?: Scope };
  } catch {
    // empty body is OK
  }
  const scope: Scope = body.scope ?? 'all';
  const scopes: Scope[] = scope === 'all' ? ALL_SCOPES : [scope];

  const supabase = createAdminClient();

  const deleted = { goals: 0, tasks: 0, problems: 0, personas: 0, scenarios: 0 };

  const tasks: Array<Promise<unknown>> = [];

  // Tasks first (so goal FK doesn't block goals delete).
  if (scopes.includes('tasks')) {
    tasks.push(clearTable(supabase, 'tasks').then((n) => { deleted.tasks = n; }));
  }
  if (scopes.includes('problems')) {
    tasks.push(clearTable(supabase, 'problems').then((n) => { deleted.problems = n; }));
  }
  if (scopes.includes('customers')) {
    // persona_scenarios / sku_scenarios cascade via FK ON DELETE CASCADE.
    tasks.push(clearTable(supabase, 'customer_personas').then((n) => { deleted.personas = n; }));
    tasks.push(clearTable(supabase, 'purchase_scenarios').then((n) => { deleted.scenarios = n; }));
  }

  await Promise.allSettled(tasks);

  // Goals after tasks.
  if (scopes.includes('goals')) {
    deleted.goals = await clearTable(supabase, 'goals');
  }

  return NextResponse.json({ deleted });
}
