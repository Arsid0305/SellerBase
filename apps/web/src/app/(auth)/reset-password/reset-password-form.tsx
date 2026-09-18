'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/client';
import { Button } from '@/shared/ui/button';

/** Минимальная длина. Восемь - нижняя граница, ниже которой смысла нет. */
const MIN_DLINA = 8;

export function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Поля не управляются React - чтобы менеджер паролей мог предложить
    // и сохранить новый пароль. Значения читаем из формы.
    const fd = new FormData(e.currentTarget);
    const pass = String(fd.get('password') ?? '');
    const again = String(fd.get('password2') ?? '');

    if (pass.length < MIN_DLINA) {
      setError(`Пароль короче ${MIN_DLINA} знаков - так нельзя`);
      return;
    }
    if (pass !== again) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updErr } = await supabase.auth.updateUser({ password: pass });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить пароль');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-muted-foreground">Новый пароль</span>
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="new-password"
          minLength={MIN_DLINA}
          onChange={() => setError(null)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Не короче восьми знаков"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-muted-foreground">Ещё раз</span>
        <input
          type="password"
          name="password2"
          required
          autoComplete="new-password"
          minLength={MIN_DLINA}
          onChange={() => setError(null)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Повтори тот же пароль"
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Сохраняю…' : 'Сохранить и войти'}
      </Button>
    </form>
  );
}
