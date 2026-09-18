'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/shared/lib/supabase/client';
import { Button } from '@/shared/ui/button';

/**
 * Выход из программы.
 *
 * Кнопки выхода не было вообще - ни одной на весь сайт. Владелица 18.09.2026:
 * «я зашла и всё, я не могу выйти». Войти можно было, выйти нельзя.
 *
 * Это не только неудобство. Без выхода нельзя сменить учётную запись, нельзя
 * закрыть доступ на чужом устройстве и нельзя проверить, что вход вообще
 * работает: чтобы войти, надо сначала выйти.
 */
export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace('/login');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleLogout}
      disabled={loading}
      aria-label="Выйти"
      title="Выйти"
    >
      <LogOut className="size-4" />
    </Button>
  );
}
