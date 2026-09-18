'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/client';
import { Button } from '@/shared/ui/button';

/**
 * Вход в программу.
 *
 * Поля намеренно НЕ управляются состоянием React. Так было, и из-за этого
 * менеджер паролей не срабатывал: он пишет значение прямо в поле, минуя
 * React, а React тут же возвращает поле к своему пустому состоянию. Браузер
 * проверяет обязательность до отправки формы, видит пустоту и отказывает -
 * до обработчика дело не доходило вообще.
 *
 * Теперь значение живёт в самом поле, а на отправке читается из формы.
 */
export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      const emailValue = String(fd.get('email') ?? '').trim();
      const passwordValue = String(fd.get('password') ?? '');

      if (!emailValue || !passwordValue) {
        setError('Заполните почту и пароль');
        return;
      }

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailValue,
        password: passwordValue,
      });
      if (authError) {
        setError(authError.message);
      } else {
        router.replace('/');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-muted-foreground">Email</span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          onChange={() => setError(null)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="you@example.com"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-muted-foreground">Пароль</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          onChange={() => setError(null)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          /*
            Заполнитель НЕ из точек. Точки выглядели как уже введённый пароль:
            владелица нажимала «Войти» по пустому полю и получала отказ
            браузера при заполненном на вид поле. 18.09.2026.
          */
          placeholder="Введите пароль"
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Вход…' : 'Войти'}
      </Button>
    </form>
  );
}
