import { PageHeader } from '@/widgets/app-shell/page-header';
import { fetchSettings, fetchTelegramStatus } from '@/entities/notifications';
import { NotificationSettingsForm } from '@/features/notifications';

export const metadata = { title: 'Уведомления' };
export const dynamic = 'force-dynamic';

export default async function NotificationSettingsPage() {
  const [settings, telegram] = await Promise.all([fetchSettings(), fetchTelegramStatus()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Уведомления"
        description="Каналы доставки, тихие часы и подключение Telegram / Web Push."
      />
      <NotificationSettingsForm initial={settings} telegram={telegram} />
    </div>
  );
}
