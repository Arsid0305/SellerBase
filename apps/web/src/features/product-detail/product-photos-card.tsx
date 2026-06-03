import { ImageIcon } from 'lucide-react';
import { CategoryCard } from '@/shared/ui/domain/category-card';

export function ProductPhotosCard() {
  return (
    <CategoryCard title="Фотографии" tone="violet" icon={ImageIcon}>
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageIcon className="size-8 opacity-60" />
          <span className="text-xs">Изображения подтянутся из API WB</span>
        </div>
      </div>
    </CategoryCard>
  );
}
