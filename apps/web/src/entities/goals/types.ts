export type GoalMetric = 'revenue' | 'margin' | 'units' | 'custom';
export type GoalStatus = 'active' | 'achieved' | 'paused' | 'cancelled';
export type GoalScope = 'all' | 'sku' | 'category';

export type Goal = {
  id: number;
  title: string;
  metric: GoalMetric;
  targetValue: number | null;
  currentValue: number | null;
  deadline: string | null;
  status: GoalStatus;
  scope: GoalScope;
  scopeValue: string | null;
};

export type GoalInput = {
  title: string;
  metric: GoalMetric;
  targetValue: number | null;
  currentValue: number | null;
  deadline: string | null;
  status: GoalStatus;
  scope: GoalScope;
  scopeValue: string | null;
};

export type GoalPatch = Partial<GoalInput>;
