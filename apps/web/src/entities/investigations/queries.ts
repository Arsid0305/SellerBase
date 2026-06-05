import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  Problem,
  ProblemInput,
  ProblemPatch,
  ProblemStatus,
  ProblemSeverity,
  ProblemSource,
  ProblemDetail,
  Investigation,
  InvestigationInput,
  InvestigationStatus,
  Cause,
  CauseInput,
  Hypothesis,
  HypothesisInput,
  HypothesisStatus,
  KnowledgeItem,
  KnowledgeInput,
  KnowledgeCategory,
} from './types';

const TABLE_MISSING = '42P01';

type ProblemDb = {
  id: number;
  title: string;
  description: string | null;
  severity: string;
  scope_sku_id: number | null;
  scope_category: string | null;
  status: string;
  source: string;
  detected_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type InvestigationDb = {
  id: number;
  problem_id: number;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type CauseDb = {
  id: number;
  investigation_id: number;
  title: string;
  description: string | null;
  confidence: number;
  is_confirmed: boolean;
  created_at: string;
};

type HypothesisDb = {
  id: number;
  cause_id: number;
  statement: string;
  test_plan: string | null;
  status: string;
  result: string | null;
  created_at: string;
};

type KnowledgeDb = {
  id: number;
  hypothesis_id: number | null;
  title: string;
  insight: string;
  category: string | null;
  created_at: string;
};

function mapProblem(r: ProblemDb): Problem {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    severity: (r.severity as ProblemSeverity) ?? 'med',
    scopeSkuId: r.scope_sku_id,
    scopeCategory: r.scope_category,
    status: (r.status as ProblemStatus) ?? 'open',
    source: (r.source as ProblemSource) ?? 'manual',
    detectedAt: r.detected_at,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapInvestigation(r: InvestigationDb): Investigation {
  return {
    id: r.id,
    problemId: r.problem_id,
    notes: r.notes,
    status: (r.status as InvestigationStatus) ?? 'active',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapCause(r: CauseDb): Cause {
  return {
    id: r.id,
    investigationId: r.investigation_id,
    title: r.title,
    description: r.description,
    confidence: r.confidence,
    isConfirmed: r.is_confirmed,
    createdAt: r.created_at,
  };
}

function mapHypothesis(r: HypothesisDb): Hypothesis {
  return {
    id: r.id,
    causeId: r.cause_id,
    statement: r.statement,
    testPlan: r.test_plan,
    status: (r.status as HypothesisStatus) ?? 'proposed',
    result: r.result,
    createdAt: r.created_at,
  };
}

function mapKnowledge(r: KnowledgeDb): KnowledgeItem {
  return {
    id: r.id,
    hypothesisId: r.hypothesis_id,
    title: r.title,
    insight: r.insight,
    category: (r.category as KnowledgeCategory | null) ?? null,
    createdAt: r.created_at,
  };
}

const PROBLEM_COLS =
  'id, title, description, severity, scope_sku_id, scope_category, status, source, detected_at, resolved_at, created_at, updated_at';
const INVESTIGATION_COLS = 'id, problem_id, notes, status, created_at, updated_at';
const CAUSE_COLS = 'id, investigation_id, title, description, confidence, is_confirmed, created_at';
const HYPOTHESIS_COLS = 'id, cause_id, statement, test_plan, status, result, created_at';
const KNOWLEDGE_COLS = 'id, hypothesis_id, title, insight, category, created_at';

export async function fetchProblems(filter?: { status?: ProblemStatus }): Promise<Problem[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from('problems')
    .select(PROBLEM_COLS)
    .order('created_at', { ascending: false })
    .range(0, 5000);
  if (filter?.status) q = q.eq('status', filter.status);
  const { data, error } = await q;
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchProblems]', error);
    return [];
  }
  return (data ?? []).map((r: ProblemDb) => mapProblem(r));
}

export async function fetchProblemDetail(id: number): Promise<ProblemDetail | null> {
  const supabase = createAdminClient();
  const { data: pData, error: pErr } = await supabase
    .from('problems')
    .select(PROBLEM_COLS)
    .eq('id', id)
    .maybeSingle();
  if (pErr) {
    if (pErr.code === TABLE_MISSING) return null;
    console.error('[fetchProblemDetail.problem]', pErr);
    return null;
  }
  if (!pData) return null;
  const problem = mapProblem(pData as ProblemDb);

  const { data: invData, error: invErr } = await supabase
    .from('investigations')
    .select(INVESTIGATION_COLS)
    .eq('problem_id', id)
    .order('created_at', { ascending: true });
  if (invErr && invErr.code !== TABLE_MISSING) {
    console.error('[fetchProblemDetail.investigations]', invErr);
  }
  const investigations = (invData ?? []).map((r) => mapInvestigation(r as InvestigationDb));

  if (investigations.length === 0) {
    return { problem, investigations: [] };
  }

  const invIds = investigations.map((i) => i.id);
  const { data: causeData, error: causeErr } = await supabase
    .from('causes')
    .select(CAUSE_COLS)
    .in('investigation_id', invIds)
    .order('created_at', { ascending: true });
  if (causeErr && causeErr.code !== TABLE_MISSING) {
    console.error('[fetchProblemDetail.causes]', causeErr);
  }
  const causes = (causeData ?? []).map((r) => mapCause(r as CauseDb));

  const causeIds = causes.map((c) => c.id);
  let hypotheses: Hypothesis[] = [];
  if (causeIds.length > 0) {
    const { data: hypData, error: hypErr } = await supabase
      .from('hypotheses')
      .select(HYPOTHESIS_COLS)
      .in('cause_id', causeIds)
      .order('created_at', { ascending: true });
    if (hypErr && hypErr.code !== TABLE_MISSING) {
      console.error('[fetchProblemDetail.hypotheses]', hypErr);
    }
    hypotheses = (hypData ?? []).map((r) => mapHypothesis(r as HypothesisDb));
  }

  return {
    problem,
    investigations: investigations.map((inv) => ({
      ...inv,
      causes: causes
        .filter((c) => c.investigationId === inv.id)
        .map((c) => ({
          ...c,
          hypotheses: hypotheses.filter((h) => h.causeId === c.id),
        })),
    })),
  };
}

export async function createProblem(input: ProblemInput): Promise<Problem | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('problems')
    .insert({
      title: input.title,
      description: input.description ?? null,
      severity: input.severity ?? 'med',
      scope_sku_id: input.scopeSkuId ?? null,
      scope_category: input.scopeCategory ?? null,
      status: input.status ?? 'open',
      source: input.source ?? 'manual',
    })
    .select(PROBLEM_COLS)
    .single();
  if (error) {
    console.error('[createProblem]', error);
    return null;
  }
  return mapProblem(data as ProblemDb);
}

export async function updateProblem(id: number, patch: ProblemPatch): Promise<Problem | null> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.severity !== undefined) update.severity = patch.severity;
  if (patch.scopeSkuId !== undefined) update.scope_sku_id = patch.scopeSkuId;
  if (patch.scopeCategory !== undefined) update.scope_category = patch.scopeCategory;
  if (patch.status !== undefined) {
    update.status = patch.status;
    update.resolved_at =
      patch.status === 'resolved' || patch.status === 'closed' ? new Date().toISOString() : null;
  }
  if (patch.source !== undefined) update.source = patch.source;

  const { data, error } = await supabase
    .from('problems')
    .update(update)
    .eq('id', id)
    .select(PROBLEM_COLS)
    .single();
  if (error) {
    console.error('[updateProblem]', error);
    return null;
  }
  return mapProblem(data as ProblemDb);
}

export async function deleteProblem(id: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('problems').delete().eq('id', id);
  if (error) {
    console.error('[deleteProblem]', error);
    return false;
  }
  return true;
}

export async function createInvestigation(input: InvestigationInput): Promise<Investigation | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('investigations')
    .insert({
      problem_id: input.problemId,
      notes: input.notes ?? null,
      status: input.status ?? 'active',
    })
    .select(INVESTIGATION_COLS)
    .single();
  if (error) {
    console.error('[createInvestigation]', error);
    return null;
  }
  return mapInvestigation(data as InvestigationDb);
}

export async function addCause(input: CauseInput): Promise<Cause | null> {
  const supabase = createAdminClient();
  const conf = Math.max(0, Math.min(100, input.confidence ?? 50));
  const { data, error } = await supabase
    .from('causes')
    .insert({
      investigation_id: input.investigationId,
      title: input.title,
      description: input.description ?? null,
      confidence: conf,
      is_confirmed: input.isConfirmed ?? false,
    })
    .select(CAUSE_COLS)
    .single();
  if (error) {
    console.error('[addCause]', error);
    return null;
  }
  return mapCause(data as CauseDb);
}

export async function addHypothesis(input: HypothesisInput): Promise<Hypothesis | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('hypotheses')
    .insert({
      cause_id: input.causeId,
      statement: input.statement,
      test_plan: input.testPlan ?? null,
      status: input.status ?? 'proposed',
    })
    .select(HYPOTHESIS_COLS)
    .single();
  if (error) {
    console.error('[addHypothesis]', error);
    return null;
  }
  return mapHypothesis(data as HypothesisDb);
}

export async function confirmHypothesis(
  id: number,
  result: string,
  status: HypothesisStatus = 'confirmed',
): Promise<Hypothesis | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('hypotheses')
    .update({ status, result })
    .eq('id', id)
    .select(HYPOTHESIS_COLS)
    .single();
  if (error) {
    console.error('[confirmHypothesis]', error);
    return null;
  }
  return mapHypothesis(data as HypothesisDb);
}

export async function addKnowledge(input: KnowledgeInput): Promise<KnowledgeItem | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('knowledge')
    .insert({
      hypothesis_id: input.hypothesisId ?? null,
      title: input.title,
      insight: input.insight,
      category: input.category ?? null,
    })
    .select(KNOWLEDGE_COLS)
    .single();
  if (error) {
    console.error('[addKnowledge]', error);
    return null;
  }
  return mapKnowledge(data as KnowledgeDb);
}

export async function fetchKnowledge(): Promise<KnowledgeItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('knowledge')
    .select(KNOWLEDGE_COLS)
    .order('created_at', { ascending: false })
    .range(0, 5000);
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchKnowledge]', error);
    return [];
  }
  return (data ?? []).map((r) => mapKnowledge(r as KnowledgeDb));
}
