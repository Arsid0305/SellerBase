import { navGroups, navItems, type NavItem } from '@/shared/config/nav';
import type { MenuEntry } from './types';

export type ResolvedEntry =
  | { kind: 'item'; item: NavItem; hidden: boolean }
  | { kind: 'divider'; label?: string };

/** Меню по умолчанию: группы программы превращаются в подписанные черты. */
export function defaultEntries(): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const g of navGroups) {
    const items = navItems.filter((i) => i.group === g.id);
    if (items.length === 0) continue;
    out.push({ kind: 'divider', label: g.title });
    for (const i of items) out.push({ kind: 'item', href: i.href });
  }
  return out;
}

/**
 * Сводит сохранённый порядок с реальными разделами программы.
 * Пункты, которых в сохранённом порядке нет (появились после обновления),
 * добавляются в конец - раздел не пропадает молча.
 */
export function resolveMenu(entries: MenuEntry[]): ResolvedEntry[] {
  const source = entries.length > 0 ? entries : defaultEntries();
  const byHref = new Map(navItems.map((i) => [i.href, i]));
  const used = new Set<string>();
  const out: ResolvedEntry[] = [];

  for (const e of source) {
    if (e.kind === 'divider') {
      out.push({ kind: 'divider', label: e.label });
      continue;
    }
    const item = byHref.get(e.href);
    if (!item) continue; // раздел удалён из программы
    used.add(e.href);
    out.push({ kind: 'item', item, hidden: e.hidden === true });
  }

  const missing = navItems.filter((i) => !used.has(i.href));
  if (missing.length > 0) {
    out.push({ kind: 'divider', label: 'Новое' });
    for (const i of missing) out.push({ kind: 'item', item: i, hidden: false });
  }
  return out;
}

/** Убирает пустые и задвоенные черты - чтобы после скрытия пунктов не оставалось дыр. */
export function tidy(entries: ResolvedEntry[]): ResolvedEntry[] {
  const visible = entries.filter((e) => e.kind === 'divider' || !e.hidden);
  const out: ResolvedEntry[] = [];
  for (const e of visible) {
    if (e.kind === 'divider') {
      const prev = out[out.length - 1];
      if (!prev || prev.kind === 'divider') {
        if (prev?.kind === 'divider') out.pop();
      }
      out.push(e);
    } else {
      out.push(e);
    }
  }
  while (out.length > 0 && out[out.length - 1]?.kind === 'divider') out.pop();
  return out;
}
