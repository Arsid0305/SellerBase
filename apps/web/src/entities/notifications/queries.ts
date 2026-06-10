import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  AppNotification,
  NotificationSettings,
  NotificationSettingsPatch,
  NotificationSeverity,
  TelegramStatus,
} from './types';

type Row = {
  id: number;
  kind: string;
  severity: string | null;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean | null;
  created_at: string;
};

const MISSING_TABLE = '42P01';

function mapRow(r: Row): AppNotification {
  return {
    id: r.id,
    kind: r.kind,
    severity: (r.severity as NotificationSeverity) ?? 'info',
    title: r.title,
    body: r.body,
    link: r.link,
    isRead: r.is_read ?? false,
    createdAt: r.created_at,
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  bellEnabled: true,
  telegramEnabled: true,
  pushEnabled: true,
  quietFrom: 23,
  quietTo: 8,
};

export async function fetchUnread(): Promise<AppNotification[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    if (error.code === MISSING_TABLE) return [];
    throw new Error(`[notifications] fetchUnread: ${error.message}`);
  }
  return (data as Row[]).map(mapRow);
}

export async function fetchAll(limit = 15): Promise<AppNotification[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === MISSING_TABLE) return [];
    throw new Error(`[notifications] fetchAll: ${error.message}`);
  }
  return (data as Row[]).map(mapRow);
}

export async function countUnread(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  if (error) {
    if (error.code === MISSING_TABLE) return 0;
    throw new Error(`[notifications] countUnread: ${error.message}`);
  }
  return count ?? 0;
}

export async function markRead(id: number): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error && error.code !== MISSING_TABLE) {
    throw new Error(`[notifications] markRead: ${error.message}`);
  }
}

export async function markAllRead(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);
  if (error && error.code !== MISSING_TABLE) {
    throw new Error(`[notifications] markAllRead: ${error.message}`);
  }
}

export async function fetchSettings(): Promise<NotificationSettings> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('notification_settings')
    .select('bell_enabled, telegram_enabled, push_enabled, quiet_from, quiet_to')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    if (error.code === MISSING_TABLE) return DEFAULT_SETTINGS;
    throw new Error(`[notifications] fetchSettings: ${error.message}`);
  }
  if (!data) return DEFAULT_SETTINGS;
  return {
    bellEnabled: data.bell_enabled ?? true,
    telegramEnabled: data.telegram_enabled ?? true,
    pushEnabled: data.push_enabled ?? true,
    quietFrom: data.quiet_from ?? 23,
    quietTo: data.quiet_to ?? 8,
  };
}

export async function updateSettings(
  patch: NotificationSettingsPatch,
): Promise<NotificationSettings> {
  const supabase = createAdminClient();
  const row: Record<string, unknown> = { id: 1 };
  if (patch.bellEnabled !== undefined) row.bell_enabled = patch.bellEnabled;
  if (patch.telegramEnabled !== undefined) row.telegram_enabled = patch.telegramEnabled;
  if (patch.pushEnabled !== undefined) row.push_enabled = patch.pushEnabled;
  if (patch.quietFrom !== undefined) row.quiet_from = patch.quietFrom;
  if (patch.quietTo !== undefined) row.quiet_to = patch.quietTo;

  const { error } = await supabase
    .from('notification_settings')
    .upsert(row, { onConflict: 'id' });
  if (error && error.code !== MISSING_TABLE) {
    throw new Error(`[notifications] updateSettings: ${error.message}`);
  }
  return fetchSettings();
}

export async function fetchTelegramStatus(): Promise<TelegramStatus> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('notification_subscribers')
    .select('is_active')
    .eq('channel', 'telegram')
    .limit(1);
  if (error) {
    if (error.code === MISSING_TABLE) return { connected: false, active: false };
    throw new Error(`[notifications] fetchTelegramStatus: ${error.message}`);
  }
  const rows = (data as { is_active: boolean | null }[]) ?? [];
  if (rows.length === 0) return { connected: false, active: false };
  return { connected: true, active: rows.some((r) => r.is_active) };
}
