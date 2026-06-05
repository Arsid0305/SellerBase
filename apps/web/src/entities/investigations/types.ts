export type ProblemSeverity = 'low' | 'med' | 'high' | 'critical';
export type ProblemStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type ProblemSource = 'manual' | 'anomaly' | 'goal_drift';

export type InvestigationStatus = 'active' | 'paused' | 'completed';

export type HypothesisStatus = 'proposed' | 'testing' | 'confirmed' | 'rejected';

export type KnowledgeCategory = 'pricing' | 'promotion' | 'stock' | 'content' | 'other';

export type Problem = {
  id: number;
  title: string;
  description: string | null;
  severity: ProblemSeverity;
  scopeSkuId: number | null;
  scopeCategory: string | null;
  status: ProblemStatus;
  source: ProblemSource;
  detectedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProblemInput = {
  title: string;
  description?: string | null;
  severity?: ProblemSeverity;
  scopeSkuId?: number | null;
  scopeCategory?: string | null;
  status?: ProblemStatus;
  source?: ProblemSource;
};

export type ProblemPatch = Partial<ProblemInput>;

export type Investigation = {
  id: number;
  problemId: number;
  notes: string | null;
  status: InvestigationStatus;
  createdAt: string;
  updatedAt: string;
};

export type InvestigationInput = {
  problemId: number;
  notes?: string | null;
  status?: InvestigationStatus;
};

export type Cause = {
  id: number;
  investigationId: number;
  title: string;
  description: string | null;
  confidence: number;
  isConfirmed: boolean;
  createdAt: string;
};

export type CauseInput = {
  investigationId: number;
  title: string;
  description?: string | null;
  confidence?: number;
  isConfirmed?: boolean;
};

export type Hypothesis = {
  id: number;
  causeId: number;
  statement: string;
  testPlan: string | null;
  status: HypothesisStatus;
  result: string | null;
  createdAt: string;
};

export type HypothesisInput = {
  causeId: number;
  statement: string;
  testPlan?: string | null;
  status?: HypothesisStatus;
};

export type KnowledgeItem = {
  id: number;
  hypothesisId: number | null;
  title: string;
  insight: string;
  category: KnowledgeCategory | null;
  createdAt: string;
};

export type KnowledgeInput = {
  hypothesisId?: number | null;
  title: string;
  insight: string;
  category?: KnowledgeCategory | null;
};

export type ProblemDetail = {
  problem: Problem;
  investigations: Array<
    Investigation & {
      causes: Array<Cause & { hypotheses: Hypothesis[] }>;
    }
  >;
};

export const PROBLEM_SEVERITIES: ProblemSeverity[] = ['low', 'med', 'high', 'critical'];
export const PROBLEM_STATUSES: ProblemStatus[] = ['open', 'investigating', 'resolved', 'closed'];
export const PROBLEM_SOURCES: ProblemSource[] = ['manual', 'anomaly', 'goal_drift'];
export const INVESTIGATION_STATUSES: InvestigationStatus[] = ['active', 'paused', 'completed'];
export const HYPOTHESIS_STATUSES: HypothesisStatus[] = ['proposed', 'testing', 'confirmed', 'rejected'];
export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = ['pricing', 'promotion', 'stock', 'content', 'other'];

export const PROBLEM_SEVERITY_LABEL: Record<ProblemSeverity, string> = {
  low: 'Низкая',
  med: 'Средняя',
  high: 'Высокая',
  critical: 'Критическая',
};

export const PROBLEM_STATUS_LABEL: Record<ProblemStatus, string> = {
  open: 'Открыта',
  investigating: 'В расследовании',
  resolved: 'Решена',
  closed: 'Закрыта',
};

export const PROBLEM_SOURCE_LABEL: Record<ProblemSource, string> = {
  manual: 'Вручную',
  anomaly: 'Аномалия',
  goal_drift: 'Отклонение цели',
};

export const INVESTIGATION_STATUS_LABEL: Record<InvestigationStatus, string> = {
  active: 'Активно',
  paused: 'Пауза',
  completed: 'Завершено',
};

export const HYPOTHESIS_STATUS_LABEL: Record<HypothesisStatus, string> = {
  proposed: 'Предложена',
  testing: 'Проверяется',
  confirmed: 'Подтверждена',
  rejected: 'Отклонена',
};

export const KNOWLEDGE_CATEGORY_LABEL: Record<KnowledgeCategory, string> = {
  pricing: 'Ценообразование',
  promotion: 'Промо',
  stock: 'Запас',
  content: 'Контент',
  other: 'Прочее',
};
