export type Gender = 'female' | 'male' | 'any';
export type IncomeLevel = 'low' | 'mid' | 'high';
export type Level3 = 'low' | 'med' | 'high';

export type Persona = {
  id: number;
  name: string;
  description: string | null;
  ageMin: number | null;
  ageMax: number | null;
  gender: Gender | null;
  incomeLevel: IncomeLevel | null;
  notes: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type PersonaInput = {
  name: string;
  description?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  gender?: Gender | null;
  incomeLevel?: IncomeLevel | null;
  notes?: Record<string, unknown> | null;
};

export type PersonaPatch = Partial<PersonaInput>;

export type Scenario = {
  id: number;
  title: string;
  description: string | null;
  trigger: string | null;
  urgency: Level3;
  priceSensitivity: Level3;
  createdAt: string;
};

export type ScenarioInput = {
  title: string;
  description?: string | null;
  trigger?: string | null;
  urgency?: Level3;
  priceSensitivity?: Level3;
};

export type ScenarioPatch = Partial<ScenarioInput>;

export type PersonaScenario = {
  personaId: number;
  scenarioId: number;
  weight: number;
};

export type SkuScenario = {
  skuId: number;
  scenarioId: number;
  fitScore: number;
};

export type PersonaWithScenarios = Persona & {
  scenarios: Array<Scenario & { weight: number }>;
};

export type ScenarioWithRelations = Scenario & {
  personas: Array<Persona & { weight: number }>;
  skus: Array<{ id: number; title: string; barcode: string | null; fitScore: number }>;
};

export const GENDERS: Gender[] = ['female', 'male', 'any'];
export const INCOME_LEVELS: IncomeLevel[] = ['low', 'mid', 'high'];
export const LEVELS_3: Level3[] = ['low', 'med', 'high'];

export const GENDER_LABEL: Record<Gender, string> = {
  female: 'Женский',
  male: 'Мужской',
  any: 'Любой',
};

export const INCOME_LABEL: Record<IncomeLevel, string> = {
  low: 'Низкий',
  mid: 'Средний',
  high: 'Высокий',
};

export const LEVEL_LABEL: Record<Level3, string> = {
  low: 'Низкая',
  med: 'Средняя',
  high: 'Высокая',
};
