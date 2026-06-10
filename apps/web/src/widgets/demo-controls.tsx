'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';

type Scope = 'goals' | 'tasks' | 'problems' | 'customers' | 'all';

export function DemoControls({ scope }: { scope: Scope }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'seed' | 'clear' | null>(null);

  async function run(kind: 'seed' | 'clear') {
    const verb = kind === 'seed' ? 'Заполнить демо-данными?' : 'Удалить все демо-данные?';
    if (typeof window !== 'undefined' && !window.confirm(verb)) return;
    setLoading(kind);
    try {
      const res = await fetch(`/api/demo/${kind}`, {
        method: kind === 'seed' ? 'POST' : 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      if (!res.ok) {
        console.error('[demo-controls]', kind, await res.text());
      }
    } catch (e) {
      console.error('[demo-controls]', kind, e);
    } finally {
      setLoading(null);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="border-sky-300 text-sky-700 hover:bg-sky-50"
        disabled={loading !== null}
        onClick={() => run('seed')}
      >
        {loading === 'seed' ? 'Заполняю…' : 'Заполнить демо'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="border-rose-300 text-rose-700 hover:bg-rose-50"
        disabled={loading !== null}
        onClick={() => run('clear')}
      >
        {loading === 'clear' ? 'Очищаю…' : 'Очистить демо'}
      </Button>
    </div>
  );
}

export function DemoEmptyHint({ scope }: { scope: Scope }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function seed() {
    setLoading(true);
    try {
      await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
    } catch (e) {
      console.error('[demo-empty-hint]', e);
    } finally {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-6 py-12 text-center">
      <p className="max-w-md text-sm text-neutral-600">
        Здесь пока пусто. Заполни раздел демо-данными чтобы посмотреть как он работает — потом
        очистишь одной кнопкой.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="border-sky-300 text-sky-700 hover:bg-sky-50"
        disabled={loading}
        onClick={seed}
      >
        {loading ? 'Заполняю…' : 'Заполнить демо чтобы посмотреть как работает раздел'}
      </Button>
    </div>
  );
}
