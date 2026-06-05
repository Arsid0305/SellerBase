import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { Goal, GoalInput, GoalMetric, GoalPatch, GoalScope, GoalStatus } from './types';

type Row = {
  id: number;
  title: string;
  metric: string;
  target_value: string | number | null;
  current_value: string | number | null;
  deadline: string | null;
  status: string;
  scope: string;
  scope_value: string | null;
};

function toNum(v: string | number | null): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(r: Row): Goal {
  return {
    id: r.id,
    title: r.title,
    metric: (r.metric as GoalMetric) ?? 'custom',
    targetValue: toNum(r.target_value),
    currentValue: toNum(r.current_value),
    deadline: r.deadline,
    status: (r.status as GoalStatus) ?? 'active',
    scope: (r.scope as GoalScope) ?? 'all',
    scopeValue: r.scope_value,
  };
}

function toRow(input: GoalPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.title !== undefined) row.title = input.title;
  if (input.metric !== undefined) row.metric = input.metric;
  if (input.targetValue !== undefined) row.target_value = input.targetValue;
  if (input.currentValue !== undefined) row.current_value = input.currentValue;
  if (input.deadline !== undefined) row.deadline = input.deadline;
  if (input.status !== undefined) row.status = input.status;
  if (input.scope !== undefined) row.scope = input.scope;
  if (input.scopeValue !== undefined) row.scope_value = input.scopeValue;
  return row;
}

export async function fetchGoals(): Promise<Goal[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('status', { ascending: true })
    .order('deadline', { ascending: true, nullsFirst: false });
  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(`[goals] fetchGoals: ${error.message}`);
  }
  return ((data ?? []) as Row[]).map(mapRow);
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('goals')
    .insert(toRow(input))
    .select('*')
    .single();
  if (error) throw new Error(`[goals] createGoal: ${error.message}`);
  return mapRow(data as Row);
}

export async function updateGoal(id: number, patch: GoalPatch): Promise<Goal> {
  const supabase = createAdminClient();
  const payload = { ...toRow(patch), updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('goals')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`[goals] updateGoal: ${error.message}`);
  return mapRow(data as Row);
}

export async function deleteGoal(id: number): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw new Error(`[goals] deleteGoal: ${error.message}`);
}
