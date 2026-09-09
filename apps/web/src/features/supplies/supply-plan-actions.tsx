'use client';

import { Download } from 'lucide-react';

// Действия по плану поставки. Отправки в WB здесь нет и не будет без отдельного
// распоряжения владелицы: 05.09.2026 принято решение «абсолютно все записи
// на ВБ отменяются, только ручные». Поставка заводится в кабинете руками.
//
// До этого компонент назывался SendToWbButton и отправлял план через
// /api/supplies/plan/[id]/send-to-wb → Edge Function create-wb-supply.
// Всё это удалено, прежний код — в истории git по файлу send-to-wb-button.tsx.
//
// Осталось скачивание ТЗ для фулфилмента: это файл, а не запись в кабинет.

type Props = {
  planId: number;
};

export function SupplyPlanActions({ planId }: Props) {
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
