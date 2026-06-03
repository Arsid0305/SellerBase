'use client';

import { Button } from '@/shared/ui/button';
import { CalendarRange } from 'lucide-react';

/**
 * PeriodComparePicker — двойной range «Текущий vs Сравнение».
 * TODO M0.2: интеграция react-day-picker, nuqs в URL, пресеты (Сегодня/7д/30д/Месяц/Квартал),
 * авто-расчёт «прошлый аналогичный период».
 */
export function PeriodComparePicker() {
  return (
    <Button variant="outline" size="sm" className="gap-2">
      <CalendarRange className="size-4" />
      <span>30 дней · vs прошлые 30</span>
    </Button>
  );
}
