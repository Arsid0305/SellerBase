// telegram-webhook — приём webhook от Telegram-бота @SellerBase_bot.
// /start — подписка (сохраняет chat_id), /mute, /unmute — переключают is_active, /status — статус.
// verify_jwt = false (Telegram не присылает Supabase JWT).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function tgSend(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("ok");

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return new Response("ok");
  }

  const msg = (update as { message?: { text?: string; chat?: { id: number } } }).message;
  if (!msg?.text || !msg.chat) return new Response("ok");

  const supabase = adminClient();
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();

  try {
    if (text === "/start") {
      await supabase
        .from("notification_subscribers")
        .upsert(
          { channel: "telegram", telegram_chat_id: chatId, is_active: true },
          { onConflict: "channel,telegram_chat_id" },
        );
      await tgSend(
        chatId,
        "✅ Подписка активна. Буду присылать алерты SellerBase: критичные SKU, аномалии, цели. Тихие часы 23:00–08:00.\n\nКоманды: /mute /unmute /status",
      );
    } else if (text === "/mute") {
      await supabase
        .from("notification_subscribers")
        .update({ is_active: false })
        .eq("channel", "telegram")
        .eq("telegram_chat_id", chatId);
      await tgSend(chatId, "🔇 Уведомления приостановлены. /unmute чтобы возобновить.");
    } else if (text === "/unmute") {
      await supabase
        .from("notification_subscribers")
        .update({ is_active: true })
        .eq("channel", "telegram")
        .eq("telegram_chat_id", chatId);
      await tgSend(chatId, "🔔 Уведомления возобновлены.");
    } else if (text === "/status") {
      const { data } = await supabase
        .from("notification_subscribers")
        .select("is_active")
        .eq("channel", "telegram")
        .eq("telegram_chat_id", chatId)
        .maybeSingle();
      await tgSend(
        chatId,
        data == null
          ? "Вы ещё не подписаны. Отправьте /start."
          : data.is_active
            ? "🔔 Подписка активна."
            : "🔇 На паузе. /unmute чтобы возобновить.",
      );
    } else {
      await tgSend(chatId, "Команды: /start /mute /unmute /status");
    }
  } catch (_e) {
    // Telegram ретраит при не-200 — отвечаем 200 всегда, чтобы не зациклить.
  }

  return new Response("ok");
});
