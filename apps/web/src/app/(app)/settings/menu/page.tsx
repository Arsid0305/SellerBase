import { PageHeader } from '@/widgets/app-shell/page-header';
import { fetchMenuLayout } from '@/entities/menu-layout';
import { MenuSettingsEditor } from '@/features/menu-settings';

export const metadata = { title: 'Настройка меню' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MenuSettingsPage() {
  const entries = await fetchMenuLayout();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Настройка меню"
        description="Переставь разделы в удобном порядке, спрячь лишние и раздели их чертой"
      />
      <MenuSettingsEditor initialEntries={entries} />
    </div>
  );
}
