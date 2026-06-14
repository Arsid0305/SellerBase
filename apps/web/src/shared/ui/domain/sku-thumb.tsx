import { cn } from '@/shared/lib/utils';

type Props = {
  src?: string | null;
  alt?: string;
  size?: 'sm' | 'md';
  className?: string;
};

const SIZE = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
};

export function SkuThumb({ src, alt = '', size = 'sm', className }: Props) {
  const cls = cn(
    'shrink-0 overflow-hidden rounded border border-border bg-muted/40',
    SIZE[size],
    className,
  );
  if (!src) return <div className={cls} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn(cls, 'object-cover')} loading="lazy" />
  );
}
