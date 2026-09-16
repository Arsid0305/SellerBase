import { createAdminClient } from '@/shared/lib/supabase/admin';
import { parseEntries, type MenuEntry } from './types';

const TABLE_MISSING = '42P01';

export async function fetchMenuLayout(): Promise<MenuEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ui_menu_layout')
    .select('entries')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    if (error.code !== TABLE_MISSING) console.error('[fetchMenuLayout]', error);
    return [];
  }
  return parseEntries((data as { entries?: unknown } | null)?.entries);
}

export async function saveMenuLayout(entries: MenuEntry[]): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('ui_menu_layout')
    .upsert({ id: 1, entries, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) {
    console.error('[saveMenuLayout]', error);
    return false;
  }
  return true;
}
