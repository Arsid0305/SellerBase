import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  Persona,
  PersonaInput,
  PersonaPatch,
  PersonaWithScenarios,
  Scenario,
  ScenarioInput,
  ScenarioPatch,
  ScenarioWithRelations,
  Gender,
  IncomeLevel,
  Level3,
} from './types';

const TABLE_MISSING = '42P01';

type PersonaDb = {
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

type ScenarioDb = {
  id: number;
  title: string;
  description: string | null;
  trigger: string | null;
  urgency: string;
  price_sensitivity: string;
  created_at: string;
};

function mapPersona(r: PersonaDb): Persona {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    ageMin: r.age_min,
    ageMax: r.age_max,
    gender: (r.gender as Gender | null) ?? null,
    incomeLevel: (r.income_level as IncomeLevel | null) ?? null,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapScenario(r: ScenarioDb): Scenario {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    trigger: r.trigger,
    urgency: (r.urgency as Level3) ?? 'med',
    priceSensitivity: (r.price_sensitivity as Level3) ?? 'med',
    createdAt: r.created_at,
  };
}

const PERSONA_COLS =
  'id, name, description, age_min, age_max, gender, income_level, notes, created_at, updated_at';
const SCENARIO_COLS =
  'id, title, description, trigger, urgency, price_sensitivity, created_at';

export async function fetchPersonas(): Promise<PersonaWithScenarios[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_personas')
    .select(PERSONA_COLS)
    .order('id', { ascending: false })
    .range(0, 5000);
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchPersonas]', error);
    return [];
  }
  const personas = (data ?? []).map((r) => mapPersona(r as PersonaDb));
  if (personas.length === 0) return [];

  const ids = personas.map((p) => p.id);
  const { data: links, error: linksErr } = await supabase
    .from('persona_scenarios')
    .select('persona_id, scenario_id, weight')
    .in('persona_id', ids);
  if (linksErr) {
    if (linksErr.code === TABLE_MISSING) {
      return personas.map((p) => ({ ...p, scenarios: [] }));
    }
    console.error('[fetchPersonas/links]', linksErr);
    return personas.map((p) => ({ ...p, scenarios: [] }));
  }
  const scenarioIds = Array.from(new Set((links ?? []).map((l) => l.scenario_id as number)));
  let scenariosById = new Map<number, Scenario>();
  if (scenarioIds.length > 0) {
    const { data: scs, error: scsErr } = await supabase
      .from('purchase_scenarios')
      .select(SCENARIO_COLS)
      .in('id', scenarioIds);
    if (!scsErr && scs) {
      scenariosById = new Map(scs.map((r) => [r.id as number, mapScenario(r as ScenarioDb)]));
    }
  }
  return personas.map((p) => ({
    ...p,
    scenarios: (links ?? [])
      .filter((l) => l.persona_id === p.id)
      .map((l) => {
        const sc = scenariosById.get(l.scenario_id as number);
        return sc ? { ...sc, weight: Number(l.weight ?? 1) } : null;
      })
      .filter((x): x is Scenario & { weight: number } => x !== null),
  }));
}

export async function fetchPersona(id: number): Promise<PersonaWithScenarios | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_personas')
    .select(PERSONA_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (error.code === TABLE_MISSING) return null;
    console.error('[fetchPersona]', error);
    return null;
  }
  if (!data) return null;
  const persona = mapPersona(data as PersonaDb);

  const { data: links, error: linksErr } = await supabase
    .from('persona_scenarios')
    .select('scenario_id, weight')
    .eq('persona_id', id);
  if (linksErr) {
    if (linksErr.code === TABLE_MISSING) return { ...persona, scenarios: [] };
    console.error('[fetchPersona/links]', linksErr);
    return { ...persona, scenarios: [] };
  }
  const scenarioIds = (links ?? []).map((l) => l.scenario_id as number);
  if (scenarioIds.length === 0) return { ...persona, scenarios: [] };

  const { data: scs, error: scsErr } = await supabase
    .from('purchase_scenarios')
    .select(SCENARIO_COLS)
    .in('id', scenarioIds);
  if (scsErr) {
    console.error('[fetchPersona/scenarios]', scsErr);
    return { ...persona, scenarios: [] };
  }
  const scenarioMap = new Map((scs ?? []).map((r) => [r.id as number, mapScenario(r as ScenarioDb)]));
  return {
    ...persona,
    scenarios: (links ?? [])
      .map((l) => {
        const sc = scenarioMap.get(l.scenario_id as number);
        return sc ? { ...sc, weight: Number(l.weight ?? 1) } : null;
      })
      .filter((x): x is Scenario & { weight: number } => x !== null),
  };
}

export async function fetchScenarios(): Promise<Scenario[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('purchase_scenarios')
    .select(SCENARIO_COLS)
    .order('id', { ascending: false })
    .range(0, 5000);
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchScenarios]', error);
    return [];
  }
  return (data ?? []).map((r) => mapScenario(r as ScenarioDb));
}

export async function fetchScenario(id: number): Promise<ScenarioWithRelations | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('purchase_scenarios')
    .select(SCENARIO_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (error.code === TABLE_MISSING) return null;
    console.error('[fetchScenario]', error);
    return null;
  }
  if (!data) return null;
  const scenario = mapScenario(data as ScenarioDb);

  const { data: pLinks, error: pErr } = await supabase
    .from('persona_scenarios')
    .select('persona_id, weight')
    .eq('scenario_id', id);
  let personas: Array<Persona & { weight: number }> = [];
  if (!pErr && pLinks && pLinks.length > 0) {
    const personaIds = pLinks.map((l) => l.persona_id as number);
    const { data: ps } = await supabase
      .from('customer_personas')
      .select(PERSONA_COLS)
      .in('id', personaIds);
    const personaMap = new Map((ps ?? []).map((r) => [r.id as number, mapPersona(r as PersonaDb)]));
    personas = pLinks
      .map((l) => {
        const p = personaMap.get(l.persona_id as number);
        return p ? { ...p, weight: Number(l.weight ?? 1) } : null;
      })
      .filter((x): x is Persona & { weight: number } => x !== null);
  }

  const { data: sLinks, error: sErr } = await supabase
    .from('sku_scenarios')
    .select('sku_id, fit_score')
    .eq('scenario_id', id);
  let skus: ScenarioWithRelations['skus'] = [];
  if (!sErr && sLinks && sLinks.length > 0) {
    const skuIds = sLinks.map((l) => l.sku_id as number);
    const { data: ss } = await supabase
      .from('sku_catalog')
      .select('id, title, barcode')
      .in('id', skuIds);
    type SkuRow = { id: number; title: string | null; barcode: string | null };
    const skuMap = new Map<number, { title: string; barcode: string | null }>(
      (ss ?? []).map((r) => {
        const row = r as SkuRow;
        return [row.id, { title: row.title ?? `SKU #${row.id}`, barcode: row.barcode }];
      }),
    );
    skus = sLinks
      .map((l) => {
        const m = skuMap.get(l.sku_id as number);
        return m
          ? { id: l.sku_id as number, title: m.title, barcode: m.barcode, fitScore: Number(l.fit_score ?? 0.5) }
          : null;
      })
      .filter((x): x is ScenarioWithRelations['skus'][number] => x !== null);
  }

  return { ...scenario, personas, skus };
}

export async function fetchScenariosBySkuId(
  skuId: number,
): Promise<Array<Scenario & { fitScore: number }>> {
  const supabase = createAdminClient();
  const { data: links, error } = await supabase
    .from('sku_scenarios')
    .select('scenario_id, fit_score')
    .eq('sku_id', skuId);
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchScenariosBySkuId]', error);
    return [];
  }
  if (!links || links.length === 0) return [];
  const ids = links.map((l) => l.scenario_id as number);
  const { data: scs, error: scsErr } = await supabase
    .from('purchase_scenarios')
    .select(SCENARIO_COLS)
    .in('id', ids);
  if (scsErr) {
    if (scsErr.code === TABLE_MISSING) return [];
    console.error('[fetchScenariosBySkuId/scenarios]', scsErr);
    return [];
  }
  const scMap = new Map((scs ?? []).map((r) => [r.id as number, mapScenario(r as ScenarioDb)]));
  return links
    .map((l) => {
      const sc = scMap.get(l.scenario_id as number);
      return sc ? { ...sc, fitScore: Number(l.fit_score ?? 0.5) } : null;
    })
    .filter((x): x is Scenario & { fitScore: number } => x !== null);
}

export async function createPersona(input: PersonaInput): Promise<Persona | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_personas')
    .insert({
      name: input.name,
      description: input.description ?? null,
      age_min: input.ageMin ?? null,
      age_max: input.ageMax ?? null,
      gender: input.gender ?? null,
      income_level: input.incomeLevel ?? null,
      notes: input.notes ?? null,
    })
    .select(PERSONA_COLS)
    .single();
  if (error) {
    console.error('[createPersona]', error);
    return null;
  }
  return mapPersona(data as PersonaDb);
}

export async function updatePersona(id: number, patch: PersonaPatch): Promise<Persona | null> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.ageMin !== undefined) update.age_min = patch.ageMin;
  if (patch.ageMax !== undefined) update.age_max = patch.ageMax;
  if (patch.gender !== undefined) update.gender = patch.gender;
  if (patch.incomeLevel !== undefined) update.income_level = patch.incomeLevel;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from('customer_personas')
    .update(update)
    .eq('id', id)
    .select(PERSONA_COLS)
    .single();
  if (error) {
    console.error('[updatePersona]', error);
    return null;
  }
  return mapPersona(data as PersonaDb);
}

export async function deletePersona(id: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('customer_personas').delete().eq('id', id);
  if (error) {
    console.error('[deletePersona]', error);
    return false;
  }
  return true;
}

export async function createScenario(input: ScenarioInput): Promise<Scenario | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('purchase_scenarios')
    .insert({
      title: input.title,
      description: input.description ?? null,
      trigger: input.trigger ?? null,
      urgency: input.urgency ?? 'med',
      price_sensitivity: input.priceSensitivity ?? 'med',
    })
    .select(SCENARIO_COLS)
    .single();
  if (error) {
    console.error('[createScenario]', error);
    return null;
  }
  return mapScenario(data as ScenarioDb);
}

export async function updateScenario(id: number, patch: ScenarioPatch): Promise<Scenario | null> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.trigger !== undefined) update.trigger = patch.trigger;
  if (patch.urgency !== undefined) update.urgency = patch.urgency;
  if (patch.priceSensitivity !== undefined) update.price_sensitivity = patch.priceSensitivity;

  const { data, error } = await supabase
    .from('purchase_scenarios')
    .update(update)
    .eq('id', id)
    .select(SCENARIO_COLS)
    .single();
  if (error) {
    console.error('[updateScenario]', error);
    return null;
  }
  return mapScenario(data as ScenarioDb);
}

export async function deleteScenario(id: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('purchase_scenarios').delete().eq('id', id);
  if (error) {
    console.error('[deleteScenario]', error);
    return false;
  }
  return true;
}

export async function linkPersonaScenario(
  personaId: number,
  scenarioId: number,
  weight = 1.0,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('persona_scenarios')
    .upsert({ persona_id: personaId, scenario_id: scenarioId, weight });
  if (error) {
    console.error('[linkPersonaScenario]', error);
    return false;
  }
  return true;
}

export async function unlinkPersonaScenario(
  personaId: number,
  scenarioId: number,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('persona_scenarios')
    .delete()
    .eq('persona_id', personaId)
    .eq('scenario_id', scenarioId);
  if (error) {
    console.error('[unlinkPersonaScenario]', error);
    return false;
  }
  return true;
}

export async function linkSkuScenario(
  skuId: number,
  scenarioId: number,
  fitScore = 0.5,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('sku_scenarios')
    .upsert({ sku_id: skuId, scenario_id: scenarioId, fit_score: fitScore });
  if (error) {
    console.error('[linkSkuScenario]', error);
    return false;
  }
  return true;
}

export async function unlinkSkuScenario(skuId: number, scenarioId: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('sku_scenarios')
    .delete()
    .eq('sku_id', skuId)
    .eq('scenario_id', scenarioId);
  if (error) {
    console.error('[unlinkSkuScenario]', error);
    return false;
  }
  return true;
}
