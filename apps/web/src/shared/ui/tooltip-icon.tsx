'use client';

import { Info } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type TooltipIconProps = {
  text: string;
  className?: string;
  size?: number;
};

/**
 * Маленькая иконка-подсказка для сложных метрик.
 * Использует native title — работает без TooltipProvider и SSR-friendly.
 */
export function TooltipIcon({ text, className, size = 12 }: TooltipIconProps) {
  return (
    <span
      title={text}
      aria-label={text}
      className={cn(
        'inline-flex cursor-help items-center text-muted-foreground/70 hover:text-foreground',
        className,
      )}
    >
      <Info style={{ width: size, height: size }} aria-hidden="true" />
    </span>
  );
}
