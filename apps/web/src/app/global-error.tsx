'use client';

// Последний рубеж: ошибка в корневом макете, до которой не доберётся
// error.tsx сегмента (app). Здесь нельзя опираться на общие стили и шрифты —
// корневой layout не отрисован, поэтому разметка своя и минимальная.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Приложение не загрузилось</h2>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>
          Ошибка произошла до отрисовки кабинета. Данные не показаны — это сбой,
          а не отсутствие продаж.
        </p>
        <pre
          style={{
            fontSize: 12,
            background: '#f5f5f5',
            padding: 8,
            borderRadius: 4,
            whiteSpace: 'pre-wrap',
            marginBottom: 16,
          }}
        >
          {error.message}
          {error.digest ? ` · ${error.digest}` : ''}
        </pre>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            borderRadius: 4,
            border: '1px solid #ccc',
            cursor: 'pointer',
          }}
        >
          Повторить
        </button>
      </body>
    </html>
  );
}
