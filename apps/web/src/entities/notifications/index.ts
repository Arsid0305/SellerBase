export {
  fetchUnread,
  fetchAll,
  countUnread,
  markRead,
  markAllRead,
  fetchSettings,
  updateSettings,
  fetchTelegramStatus,
} from './queries';
export type {
  AppNotification,
  NotificationSeverity,
  NotificationSettings,
  NotificationSettingsPatch,
  TelegramStatus,
} from './types';
