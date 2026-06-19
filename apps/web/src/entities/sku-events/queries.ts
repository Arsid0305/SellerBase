import { createAdminClient } from '@/shared/lib/supabase/admin';

export interface SkuEvent {
  id: number;
  skuId: number;
  eventDt: string;
  eventType: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  details: Record<string, unknown> | null;
}

type Row = {
  id: number;
  sku_id: number;
  event_dt: string;
  event_type: string;
  severity: string;
  title: string;
  details: Record<string, unknown> | null;
};

function toSeverity(s: string): SkuEvent['severity'] {
  return s === 'warn' || s === 'critical' ? s : 'info';
}

export async function fetchSkuEvents(skuId: number, limit = 50): Promise<SkuEvent[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_events')
    .select('id, sku_id, event_dt, event_type, severity, title, details')
    .eq('sku_id', skuId)
    .order('event_dt', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[fetchSkuEvents] error', error);
    return [];
  }
  return (data ?? []).map((r: Row) => ({
    id: r.id,
    skuId: r.sku_id,
    eventDt: r.event_dt,
    eventType: r.event_type,
    severity: toSeverity(r.severity),
    title: r.title,
    details: r.details,
  }));
}
