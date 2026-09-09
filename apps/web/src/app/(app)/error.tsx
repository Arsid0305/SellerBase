'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

// Экран ошибки для всего кабинета.
//
// Появился 05.09.2026 вместе с отказом от «мягких» сбоев в финансовых запросах.
// До этого сбой запроса к базе возвращал нули, и кабинет показывал «выручка 0 ₽»
// — день без продаж вместо «данные не пришли». По такой картинке принимали
// решения. Теперь сбой виден, а ноль остаётся значением, а не заглушкой.

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] необработанная ошибка страницы', error);
  }, [error]);

  const isDataError = error.name === 'PnlDataError';

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-lg rounded-lg border border-amber-500/40 bg-amber-500/5 p-6">
        <div className="mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-base font-semibold">
            {isDataError ? 'Данные не загрузились' : 'Страница не открылась'}
          </h2>
        </div>

        <p className="mb-2 text-sm text-muted-foreground">
          {isDataError
            ? 'Запрос к базе не прошёл, поэтому цифры не показаны. Это не значит, что продаж не было — значит, данные не пришли.'
            : 'При отрисовке страницы произошла ошибка.'}
        </p>

        <p className="mb-4 break-words rounded border border-border bg-background/60 p-2 font-mono text-xs text-muted-foreground">
          {error.message}
          {error.digest ? ` · ${error.digest}` : ''}
        </p>

        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          <RotateCw className="h-4 w-4" />
          Повторить
        </button>
      </div>
    </div>
  );
}
