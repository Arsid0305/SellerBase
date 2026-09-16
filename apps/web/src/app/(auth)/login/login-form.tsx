'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/client';
import { Button } from '@/shared/ui/button';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Менеджер паролей заполняет поля мимо React, onChange не срабатывает
      // и состояние остаётся пустым. Поэтому значения берём из самой формы.
      const form = e.currentTarget;
      const fd = new FormData(form);
      const emailValue = (String(fd.get('email') ?? '') || email).trim();
      const passwordValue = String(fd.get('password') ?? '') || password;

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="••••••••"
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Вход…' : 'Войти'}
      </Button>
    </form>
  );
}
