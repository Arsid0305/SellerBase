// Боковое меню владелица настраивает сама: порядок, разделители, скрытие.
// Порядок хранится целиком одним списком, группы «Аналитика / Операции /
// Данные» заменены разделительными чертами с подписью.

export type MenuEntry =
  | { kind: 'item'; href: string; hidden?: boolean }
  | { kind: 'divider'; label?: string };

export function isMenuEntry(v: unknown): v is MenuEntry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.kind === 'item') return typeof o.href === 'string' && o.href.length > 0;
  if (o.kind === 'divider') return o.label == null || typeof o.label === 'string';
  return false;
}

export function parseEntries(v: unknown): MenuEntry[] {
  if (!Array.isArray(v)) return [];
  const out: MenuEntry[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!isMenuEntry(raw)) continue;
    if (raw.kind === 'item') {
      if (seen.has(raw.href)) continue;
      seen.add(raw.href);
      out.push({ kind: 'item', href: raw.href, hidden: raw.hidden === true });
    } else {
      out.push({ kind: 'divider', label: raw.label?.trim() || undefined });
    }
  }
  return out;
}
