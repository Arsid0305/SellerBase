'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export async function setParticipationAction(
  promotionId: number,
  nmId: number,
  participate: boolean | null,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('wb_promotion_items')
    .update({
      user_participate: participate,
      user_decided_at: participate == null ? null : new Date().toISOString(),
      user_note: note ?? null,
    })
    .eq('promotion_id', promotionId)
    .eq('nm_id', nmId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/promo/${promotionId}`);
  revalidatePath('/promo');
  return { ok: true };
}

export async function bulkSetParticipationAction(
  promotionId: number,
  nmIds: number[],
  participate: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (nmIds.length === 0) return { ok: true };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('wb_promotion_items')
    .update({
      user_participate: participate,
      user_decided_at: new Date().toISOString(),
    })
    .eq('promotion_id', promotionId)
    .in('nm_id', nmIds);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/promo/${promotionId}`);
  revalidatePath('/promo');
  return { ok: true };
}
