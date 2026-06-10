import { redirect } from 'next/navigation';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

export const metadata = { title: 'Снимок бизнеса' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return iso(d);
}

async function openSnapshot(formData: FormData) {
  'use server';
  const raw = String(formData.get('date') ?? '').trim();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : yesterdayIso();
  redirect(`/snapshot/${valid}`);
}

export default function SnapshotIndexPage() {
  const def = yesterdayIso();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Снимок бизнеса"
        description="Цифровой двойник на конкретный день — что было известно тогда"
      />
      <Card>
        <CardHeader>
          <CardTitle>Выбрать дату</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={openSnapshot} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Дата снимка</span>
              <input
                type="date"
                name="date"
                defaultValue={def}
                max={iso(new Date())}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Открыть
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
