import { NextResponse } from 'next/server';
import { fetchSettings, fetchTelegramStatus, updateSettings } from '@/entities/notifications';
import type { NotificationSettingsPatch } from '@/entities/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

function clampHour(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(Math.trunc(n), 0), 23);
}

export async function GET() {
  try {
    const [settings, telegram] = await Promise.all([fetchSettings(), fetchTelegramStatus()]);
    return NextResponse.json({ settings, telegram });
  } catch (err) {
    return bad(err instanceof Error ? err.message : 'unknown error', 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const patch: NotificationSettingsPatch = {};
    if (body.bellEnabled !== undefined) patch.bellEnabled = Boolean(body.bellEnabled);
    if (body.telegramEnabled !== undefined) patch.telegramEnabled = Boolean(body.telegramEnabled);
    if (body.pushEnabled !== undefined) patch.pushEnabled = Boolean(body.pushEnabled);
    if (body.quietFrom !== undefined) {
      const h = clampHour(body.quietFrom);
      if (h === undefined) return bad('quietFrom invalid');
      patch.quietFrom = h;
    }
    if (body.quietTo !== undefined) {
      const h = clampHour(body.quietTo);
      if (h === undefined) return bad('quietTo invalid');
      patch.quietTo = h;
    }
    const settings = await updateSettings(patch);
    return NextResponse.json({ settings });
  } catch (err) {
    return bad(err instanceof Error ? err.message : 'unknown error', 500);
  }
}
