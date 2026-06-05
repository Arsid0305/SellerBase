import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { Task, TaskInput, TaskPatch, TaskStatus } from './types';

type TaskDb = {
  id: number;
  goal_id: number | null;
  sku_id: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};

const TABLE_MISSING = '42P01';

function mapRow(r: TaskDb): Task {
  return {
    id: r.id,
    goalId: r.goal_id,
    skuId: r.sku_id,
    title: r.title,
    description: r.description,
    status: (r.status as TaskStatus) ?? 'todo',
    priority: (r.priority as Task['priority']) ?? 'med',
    dueDate: r.due_date,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

export async function fetchTasks(filter?: { status?: TaskStatus; goalId?: number }): Promise<Task[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from('tasks')
    .select('id, goal_id, sku_id, title, description, status, priority, due_date, completed_at, created_at')
    .order('created_at', { ascending: false })
    .range(0, 5000);
  if (filter?.status) q = q.eq('status', filter.status);
  if (filter?.goalId != null) q = q.eq('goal_id', filter.goalId);

  const { data, error } = await q;
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchTasks]', error);
    return [];
  }
  return (data ?? []).map((r: TaskDb) => mapRow(r));
}

export async function createTask(input: TaskInput): Promise<Task | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title,
      description: input.description ?? null,
      goal_id: input.goalId ?? null,
      sku_id: input.skuId ?? null,
      status: input.status ?? 'todo',
      priority: input.priority ?? 'med',
      due_date: input.dueDate ?? null,
    })
    .select('id, goal_id, sku_id, title, description, status, priority, due_date, completed_at, created_at')
    .single();
  if (error) {
    console.error('[createTask]', error);
    return null;
  }
  return mapRow(data as TaskDb);
}

export async function updateTask(id: number, patch: TaskPatch): Promise<Task | null> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.goalId !== undefined) update.goal_id = patch.goalId;
  if (patch.skuId !== undefined) update.sku_id = patch.skuId;
  if (patch.status !== undefined) {
    update.status = patch.status;
    update.completed_at = patch.status === 'done' ? new Date().toISOString() : null;
  }
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate;

  const { data, error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', id)
    .select('id, goal_id, sku_id, title, description, status, priority, due_date, completed_at, created_at')
    .single();
  if (error) {
    console.error('[updateTask]', error);
    return null;
  }
  return mapRow(data as TaskDb);
}

export async function deleteTask(id: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) {
    console.error('[deleteTask]', error);
    return false;
  }
  return true;
}
