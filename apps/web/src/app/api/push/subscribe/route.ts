import { NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

type PushSubscriptionBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: Request) {
  try {
    const sub = (await req.json()) as PushSubscriptionBody;
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return bad('invalid push subscription');
    }
    const supabase = createAdminClient();
    const { error } = await supabase.from('notification_subscribers').upsert(
      {
        channel: 'push',
        push_endpoint: sub.endpoint,
        push_p256dh: sub.keys.p256dh,
        push_auth: sub.keys.auth,
        is_active: true,
      },
      { onConflict: 'channel,push_endpoint' },
    );
    if (error && error.code !== '42P01') {
      return bad(error.message, 500);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bad(err instanceof Error ? err.message : 'unknown error', 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const { endpoint } = (await req.json()) as { endpoint?: string };
    if (!endpoint) return bad('endpoint required');
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('notification_subscribers')
      .update({ is_active: false })
      .eq('channel', 'push')
      .eq('push_endpoint', endpoint);
    if (error && error.code !== '42P01') return bad(error.message, 500);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bad(err instanceof Error ? err.message : 'unknown error', 500);
  }
}
