export type NotificationSeverity = 'info' | 'warning' | 'critical';

export type AppNotification = {
  id: number;
  kind: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationSettings = {
  bellEnabled: boolean;
  telegramEnabled: boolean;
  pushEnabled: boolean;
  quietFrom: number;
  quietTo: number;
};

export type NotificationSettingsPatch = Partial<NotificationSettings>;

export type TelegramStatus = {
  connected: boolean;
  active: boolean;
};
