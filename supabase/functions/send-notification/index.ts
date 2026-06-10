// send-notification — универсальная отправка уведомления по 3 каналам.
// POST { kind, severity, title, body?, link? }
// 1. Пишет запись в notifications (колокольчик увидит всегда).
// 2. Тихие часы МСК (UTC+3) [quiet_from, quiet_to): если severity != 'critical' —
//    НЕ слать в telegram/push, только записать. critical шлёт всегда.
// 3. Telegram — всем активным подписчикам. Push — если настроены VAPID-ключи.
// verify_jwt = false (вызывается из pg_cron / других функций).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@sellerbase.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Severity = "info" | "warning" | "critical";

interface Payload {
  kind: string;
  severity?: Severity;
  title: string;
  body?: string;
  link?: string;
}

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

function mskHour(): number {
  // UTC+3 без перехода на летнее время.
  return (new Date().getUTCHours() + 3) % 24;
}

function inQuietHours(from: number, to: number): boolean {
  const h = mskHour();
  // Окно может пересекать полночь (from > to), напр. 23..8.
  return from <= to ? h >= from && h < to : h >= from || h < to;
}

async function tgSend(chatId: string, text: string): Promise<boolean> {
  if (!TOKEN) return false;
  const resp = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  return resp.ok;
}

function severityEmoji(s: Severity): string {
  return s === "critical" ? "🔴" : s === "warning" ? "🟡" : "🔵";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "invalid JSON body" }, 400);
  }
  if (!payload?.kind || !payload?.title) {
    return json({ ok: false, error: "kind and title are required" }, 400);
  }

  const severity: Severity = payload.severity ?? "info";
  const supabase = adminClient();

  // 1. Запись в notifications.
  const { data: notif, error: insErr } = await supabase
    .from("notifications")
    .insert({
      kind: payload.kind,
      severity,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
    })
    .select("id")
    .single();
  if (insErr || !notif) {
    return json({ ok: false, error: `notifications insert: ${insErr?.message}` }, 500);
  }
  const notifId: number = notif.id;

  // 2. Настройки + тихие часы.
  const { data: settings } = await supabase
    .from("notification_settings")
    .select("quiet_from, quiet_to, telegram_enabled, push_enabled")
    .eq("id", 1)
    .maybeSingle();

  const quietFrom = settings?.quiet_from ?? 23;
  const quietTo = settings?.quiet_to ?? 8;
  const telegramEnabled = settings?.telegram_enabled ?? true;
  const pushEnabled = settings?.push_enabled ?? true;

  const quiet = severity !== "critical" && inQuietHours(quietFrom, quietTo);

  if (quiet) {
    return json({ ok: true, id: notifId, quiet: true, sent_telegram: 0, sent_push: 0 });
  }

  const emoji = severityEmoji(severity);
  let sentTelegram = 0;
  let sentPush = 0;

  // 3. Telegram.
  if (telegramEnabled && TOKEN) {
    const { data: subs } = await supabase
      .from("notification_subscribers")
      .select("telegram_chat_id")
      .eq("channel", "telegram")
      .eq("is_active", true);

    const linkLine = payload.link
      ? `\n\n<a href="${payload.link}">Открыть в SellerBase</a>`
      : "";
    const text = `${emoji} <b>${payload.title}</b>${payload.body ? `\n${payload.body}` : ""}${linkLine}`;

    for (const s of subs ?? []) {
      if (!s.telegram_chat_id) continue;
      if (await tgSend(String(s.telegram_chat_id), text)) sentTelegram++;
    }
  }

  // 4. Web Push (если настроены VAPID).
  const vapidReady = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
  if (pushEnabled && vapidReady) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!);

    const { data: pushSubs } = await supabase
      .from("notification_subscribers")
      .select("id, push_endpoint, push_p256dh, push_auth")
      .eq("channel", "push")
      .eq("is_active", true);

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body ?? "",
      link: payload.link ?? "/",
    });

    for (const s of pushSubs ?? []) {
      if (!s.push_endpoint || !s.push_p256dh || !s.push_auth) continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: s.push_endpoint,
            keys: { p256dh: s.push_p256dh, auth: s.push_auth },
          },
          pushPayload,
        );
        sentPush++;
      } catch (e) {
        // 404/410 — подписка протухла, деактивируем.
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await supabase
            .from("notification_subscribers")
            .update({ is_active: false })
            .eq("id", s.id);
        }
      }
    }
  }

  await supabase
    .from("notifications")
    .update({ sent_telegram: sentTelegram > 0, sent_push: sentPush > 0 })
    .eq("id", notifId);

  return json({ ok: true, id: notifId, quiet: false, sent_telegram: sentTelegram, sent_push: sentPush });
});
