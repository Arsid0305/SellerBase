import { NextResponse } from 'next/server';
import { requireAuth } from '@/shared/lib/auth/require-auth';

// ⛔ Отправка поставок на WB отключена решением владелицы 05.09.2026:
// «абсолютно все записи на ВБ отменяются, только ручные».
//
// Маршрут отвечает 403 и до Edge Function `create-wb-supply` не доходит. Второй
// заслон стоит в самой функции — на случай вызова в обход этого маршрута.
// Прежняя реализация лежит в истории git:
// `git log -- apps/web/src/app/api/supplies/plan/[id]/send-to-wb/route.ts`.
//
// Отдельная причина не возвращать это бездумно: функция при сбое загрузки
// товаров всё равно помечала поставку отправленной, то есть в кабинете могла
// оказаться неполная поставка, а в системе — запись об успехе.

export const dynamic = 'force-dynamic';

const DISABLED_MESSAGE =
  'Отправка поставок на Wildberries отключена решением владелицы 05.09.2026. ' +
  'Поставки создаются вручную в кабинете.';

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ error: DISABLED_MESSAGE }, { status: 403 });
}
