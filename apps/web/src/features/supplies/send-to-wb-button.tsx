'use client';

import { Download } from 'lucide-react';

// ⛔ Отправка поставок на WB отключена решением владелицы 05.09.2026:
// «абсолютно все записи на ВБ отменяются, только ручные». Кнопка убрана,
// чтобы не предлагать действие, которое всё равно вернёт 403. Скачивание
// ТЗ для фулфилмента остаётся — это файл, а не запись в кабинет.
// Прежняя кнопка со всей логикой — в истории git по этому файлу.

type Props = {
  planId: number;
  /** Оставлен в типе: страница поставок его передаёт, а отправка вернётся —
   *  по распоряжению владелицы и после доработок из аудита 04.09. */
  status?: string;
};

export function SendToWbButton({ planId }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`/api/supplies/plan/${planId}/tz-ff.xlsx`}
        download
        className="inline-flex items-center gap-1.5 rounded border border-border px-4 py-2 text-sm hover:bg-accent"
      >
        <Download className="h-4 w-4" />
        Скачать ТЗ-ФФ (xlsx)
      </a>
      <span className="text-xs text-muted-foreground">
        Поставка заводится вручную в кабинете WB
      </span>
    </div>
  );
}
