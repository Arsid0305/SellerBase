import { NextResponse } from 'next/server';
import { requireAuth } from '@/shared/lib/auth/require-auth';

// ⛔ Запись цен на WB отключена решением владелицы 05.09.2026:
// «абсолютно все записи на ВБ отменяются, только ручные».
//
// Маршрут отвечает 403 и до Edge Function `set-wb-price` не доходит. Второй
// заслон стоит в самой функции — на случай вызова в обход этого маршрута.
// Прежняя реализация (валидация nmID/price/discount и вызов функции) лежит
// в истории git: `git log -- apps/web/src/app/api/promo/set-price/route.ts`.
//
// Возврат — только по прямому распоряжению владелицы и не раньше, чем будут
// закрыты три вещи из аудита 04.09: отдельный WB_TOKEN_WRITE вместо read-токена,
// существующая таблица журнала операций и проверка фактического результата
// на стороне WB.

export const dynamic = 'force-dynamic';

const DISABLED_MESSAGE =
  'Запись на Wildberries отключена решением владелицы 05.09.2026. ' +
  'Цены меняются вручную в кабинете.';

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 403 });
}
