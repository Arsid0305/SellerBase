export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'med' | 'high';

export type Task = {
  id: number;
  goalId: number | null;
  skuId: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type TaskInput = {
  title: string;
  description?: string | null;
  goalId?: number | null;
  skuId?: number | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
};

export type TaskPatch = Partial<TaskInput> & { status?: TaskStatus };

export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];
export const TASK_PRIORITIES: TaskPriority[] = ['low', 'med', 'high'];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменено',
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Низкий',
  med: 'Средний',
  high: 'Высокий',
};
