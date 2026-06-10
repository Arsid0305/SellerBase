import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Scope = 'all' | 'goals' | 'tasks' | 'problems' | 'customers';
const ALL_SCOPES: Scope[] = ['goals', 'tasks', 'problems', 'customers'];

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const DEMO_GOALS = [
  {
    title: 'Выручка > 1М в Июне',
    metric: 'revenue',
    target: 1000000,
    status: 'active',
    deadline: '2026-06-30',
  },
  {
    title: 'Средняя маржа > 25%',
    metric: 'margin',
    target: 25,
    status: 'active',
    deadline: '2026-09-30',
  },
  {
    title: '10 новых SKU за квартал',
    metric: 'units',
    target: 10,
    status: 'active',
    deadline: '2026-09-30',
  },
];

const DEMO_TASKS: Array<{
  title: string;
  priority: 'low' | 'med' | 'high';
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  goalTitle?: string;
  completedAt?: string;
}> = [
  {
    title: 'Обновить фото топ-3 SKU',
    priority: 'high',
    status: 'todo',
    goalTitle: 'Выручка > 1М в Июне',
  },
  { title: 'Поднять цену на 5% на CRITICAL', priority: 'high', status: 'todo' },
  { title: 'Запустить рекламу на NEW', priority: 'med', status: 'in_progress' },
  { title: 'Закрыть 5 негативных отзывов', priority: 'med', status: 'todo' },
  {
    title: 'Импортировать себестоимость партии',
    priority: 'low',
    status: 'done',
    completedAt: new Date().toISOString(),
  },
];

const DEMO_PROBLEMS = [
  {
    title: 'CTR упал на 30% за неделю',
    severity: 'high',
    status: 'open',
    description: 'Резкое падение кликов на карточках после смены главного фото.',
  },
  {
    title: 'Возвраты выросли в категории X',
    severity: 'med',
    status: 'investigating',
    description: 'Доля возвратов > 12% за последние 14 дней.',
  },
];

const DEMO_PERSONAS = [
  {
    name: 'Молодая мама 25-35, средний доход',
    description: 'Декрет или ранее материнство, покупает быстро через мобайл.',
    age_min: 25,
    age_max: 35,
    gender: 'female',
    income_level: 'mid',
  },
  {
    name: 'Спортсмен 30-45, выше среднего',
    description: 'Регулярно тренируется, ценит качество и долговечность.',
    age_min: 30,
    age_max: 45,
    gender: 'male',
    income_level: 'high',
  },
];

const DEMO_SCENARIOS = [
  {
    title: 'Подарок на 8 марта',
    description: 'Спонтанный поиск подарка в феврале-марте.',
    trigger: 'праздник',
    urgency: 'high',
    price_sensitivity: 'low',
  },
  {
    title: 'Спонтанная покупка для дома',
    description: 'Заметил выгоду или увидел рекламу, покупает «для себя».',
    trigger: 'импульс',
    urgency: 'med',
    price_sensitivity: 'med',
  },
  {
    title: 'Замена изношенному',
    description: 'Старый предмет вышел из строя, нужен похожий.',
    trigger: 'износ',
    urgency: 'low',
    price_sensitivity: 'high',
  },
];

const PERSONA_SCENARIO_LINKS: Array<{ personaName: string; scenarioTitle: string; weight: number }> = [
  { personaName: 'Молодая мама 25-35, средний доход', scenarioTitle: 'Подарок на 8 марта', weight: 1.0 },
  { personaName: 'Молодая мама 25-35, средний доход', scenarioTitle: 'Замена изношенному', weight: 0.7 },
  { personaName: 'Спортсмен 30-45, выше среднего', scenarioTitle: 'Замена изношенному', weight: 1.0 },
  { personaName: 'Спортсмен 30-45, выше среднего', scenarioTitle: 'Спонтанная покупка для дома', weight: 0.6 },
];

async function findExistingTitles(
  supabase: SupabaseAdmin,
  table: string,
  titleCol: string,
  titles: string[],
): Promise<Set<string>> {
  if (titles.length === 0) return new Set();
  const { data, error } = await supabase
    .from(table)
    .select(`${titleCol}`)
    .eq('source', 'demo')
    .in(titleCol, titles);
  if (error) {
    if (error.code === '42P01') return new Set();
    return new Set();
  }
  return new Set((data ?? []).map((r: Record<string, unknown>) => String(r[titleCol])));
}

async function seedGoals(supabase: SupabaseAdmin): Promise<number> {
  const existing = await findExistingTitles(
    supabase,
    'goals',
    'title',
    DEMO_GOALS.map((g) => g.title),
  );
  const toInsert = DEMO_GOALS.filter((g) => !existing.has(g.title)).map((g) => ({
    ...g,
    source: 'demo',
  }));
  if (toInsert.length === 0) return 0;
  const { error } = await supabase.from('goals').insert(toInsert);
  if (error) {
    console.error('[demo/seed goals]', error);
    return 0;
  }
  return toInsert.length;
}

async function seedTasks(supabase: SupabaseAdmin): Promise<number> {
  const existing = await findExistingTitles(
    supabase,
    'tasks',
    'title',
    DEMO_TASKS.map((t) => t.title),
  );
  const goalTitles = Array.from(
    new Set(DEMO_TASKS.map((t) => t.goalTitle).filter((s): s is string => !!s)),
  );
  let goalMap = new Map<string, number>();
  if (goalTitles.length > 0) {
    const { data: goals } = await supabase
      .from('goals')
      .select('id, title')
      .in('title', goalTitles);
    goalMap = new Map((goals ?? []).map((g: { id: number; title: string }) => [g.title, g.id]));
  }
  const toInsert = DEMO_TASKS.filter((t) => !existing.has(t.title)).map((t) => ({
    title: t.title,
    priority: t.priority,
    status: t.status,
    goal_id: t.goalTitle ? goalMap.get(t.goalTitle) ?? null : null,
    completed_at: t.completedAt ?? null,
    source: 'demo',
  }));
  if (toInsert.length === 0) return 0;
  const { error } = await supabase.from('tasks').insert(toInsert);
  if (error) {
    console.error('[demo/seed tasks]', error);
    return 0;
  }
  return toInsert.length;
}

async function seedProblems(supabase: SupabaseAdmin): Promise<number> {
  const existing = await findExistingTitles(
    supabase,
    'problems',
    'title',
    DEMO_PROBLEMS.map((p) => p.title),
  );
  const toInsert = DEMO_PROBLEMS.filter((p) => !existing.has(p.title)).map((p) => ({
    ...p,
    source: 'demo',
  }));
  if (toInsert.length === 0) return 0;
  const { error } = await supabase.from('problems').insert(toInsert);
  if (error) {
    console.error('[demo/seed problems]', error);
    return 0;
  }
  return toInsert.length;
}

async function seedCustomers(supabase: SupabaseAdmin): Promise<{ personas: number; scenarios: number; links: number }> {
  const personasExisting = await findExistingTitles(
    supabase,
    'customer_personas',
    'name',
    DEMO_PERSONAS.map((p) => p.name),
  );
  const personasToInsert = DEMO_PERSONAS.filter((p) => !personasExisting.has(p.name)).map((p) => ({
    ...p,
    source: 'demo',
  }));
  let personasCreated = 0;
  if (personasToInsert.length > 0) {
    const { error } = await supabase.from('customer_personas').insert(personasToInsert);
    if (error) {
      console.error('[demo/seed personas]', error);
    } else {
      personasCreated = personasToInsert.length;
    }
  }

  const scenariosExisting = await findExistingTitles(
    supabase,
    'purchase_scenarios',
    'title',
    DEMO_SCENARIOS.map((s) => s.title),
  );
  const scenariosToInsert = DEMO_SCENARIOS.filter((s) => !scenariosExisting.has(s.title)).map((s) => ({
    ...s,
    source: 'demo',
  }));
  let scenariosCreated = 0;
  if (scenariosToInsert.length > 0) {
    const { error } = await supabase.from('purchase_scenarios').insert(scenariosToInsert);
    if (error) {
      console.error('[demo/seed scenarios]', error);
    } else {
      scenariosCreated = scenariosToInsert.length;
    }
  }

  let linksCreated = 0;
  const { data: personasAll } = await supabase
    .from('customer_personas')
    .select('id, name')
    .in('name', DEMO_PERSONAS.map((p) => p.name));
  const { data: scenariosAll } = await supabase
    .from('purchase_scenarios')
    .select('id, title')
    .in('title', DEMO_SCENARIOS.map((s) => s.title));
  const personaMap = new Map(
    (personasAll ?? []).map((p: { id: number; name: string }) => [p.name, p.id]),
  );
  const scenarioMap = new Map(
    (scenariosAll ?? []).map((s: { id: number; title: string }) => [s.title, s.id]),
  );

  const personaScenarioRows = PERSONA_SCENARIO_LINKS.map((l) => {
    const pid = personaMap.get(l.personaName);
    const sid = scenarioMap.get(l.scenarioTitle);
    return pid && sid ? { persona_id: pid, scenario_id: sid, weight: l.weight } : null;
  }).filter((r): r is { persona_id: number; scenario_id: number; weight: number } => r !== null);

  if (personaScenarioRows.length > 0) {
    const { error } = await supabase
      .from('persona_scenarios')
      .upsert(personaScenarioRows, { onConflict: 'persona_id,scenario_id' });
    if (error) {
      console.error('[demo/seed persona_scenarios]', error);
    } else {
      linksCreated += personaScenarioRows.length;
    }
  }

  const { data: skus } = await supabase
    .from('sku_catalog')
    .select('id')
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(0, 4);
  const scenarioIds = Array.from(scenarioMap.values());
  if (skus && skus.length > 0 && scenarioIds.length > 0) {
    const skuScenarioRows = skus.map((s: { id: number }) => {
      const scenarioId = scenarioIds[Math.floor(Math.random() * scenarioIds.length)];
      const fitScore = Math.round((0.5 + Math.random() * 0.4) * 100) / 100;
      return { sku_id: s.id, scenario_id: scenarioId, fit_score: fitScore };
    });
    const { error } = await supabase
      .from('sku_scenarios')
      .upsert(skuScenarioRows, { onConflict: 'sku_id,scenario_id' });
    if (error) {
      console.error('[demo/seed sku_scenarios]', error);
    } else {
      linksCreated += skuScenarioRows.length;
    }
  }

  return { personas: personasCreated, scenarios: scenariosCreated, links: linksCreated };
}

export async function POST(req: Request) {
  let body: { scope?: Scope } = {};
  try {
    body = (await req.json()) as { scope?: Scope };
  } catch {
    // empty body is OK
  }
  const scope: Scope = body.scope ?? 'all';
  const scopes: Scope[] = scope === 'all' ? ALL_SCOPES : [scope];

  const supabase = createAdminClient();

  const created = { goals: 0, tasks: 0, problems: 0, personas: 0, scenarios: 0, links: 0 };

  const ops: Array<Promise<unknown>> = [];
  if (scopes.includes('goals') || scopes.includes('tasks')) {
    // Tasks reference goals, ensure goals seeded first.
    if (scopes.includes('goals')) {
      created.goals = await seedGoals(supabase);
    }
    if (scopes.includes('tasks')) {
      created.tasks = await seedTasks(supabase);
    }
  }
  if (scopes.includes('problems')) {
    ops.push(
      seedProblems(supabase).then((n) => {
        created.problems = n;
      }),
    );
  }
  if (scopes.includes('customers')) {
    ops.push(
      seedCustomers(supabase).then((r) => {
        created.personas = r.personas;
        created.scenarios = r.scenarios;
        created.links = r.links;
      }),
    );
  }

  await Promise.allSettled(ops);

  return NextResponse.json({ created });
}
