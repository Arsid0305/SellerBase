import { PageHeader } from '@/widgets/app-shell/page-header';
import { DemoControls, DemoEmptyHint } from '@/widgets/demo-controls';
import {
  PersonasList,
  PersonaForm,
  ScenariosList,
  ScenarioForm,
} from '@/features/customer';
import { fetchPersonas, fetchScenarios } from '@/entities/customer';

export const metadata = { title: 'Покупатели' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CustomersPage() {
  const [personas, scenarios] = await Promise.all([fetchPersonas(), fetchScenarios()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Покупатели"
          description="Персоны и сценарии покупки — кому и зачем нужен мой товар"
        />
        <DemoControls scope="customers" />
      </div>
      {personas.length === 0 && scenarios.length === 0 ? (
        <DemoEmptyHint scope="customers" />
      ) : null}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              Персоны ({personas.length})
            </h2>
            <PersonaForm />
          </div>
          <PersonasList personas={personas} />
        </section>
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              Сценарии покупки ({scenarios.length})
            </h2>
            <ScenarioForm />
          </div>
          <ScenariosList scenarios={scenarios} />
        </section>
      </div>
      <p className="text-xs text-muted-foreground">
        · Каркас VISION: персоны → сценарии → товары. Миграция `20260604_customer_scenario.sql` в этом PR не применяется.
      </p>
    </div>
  );
}
