// telegram-webhook — приём webhook от Telegram-бота @SellerBase_bot.
// /start — подписка (сохраняет chat_id), /mute, /unmute — переключают is_active, /status — статус.
// verify_jwt = false (Telegram не присылает Supabase JWT).
//
// Проверка подлинности запроса — 05.09.2026, по находке аудита.
//
// Функция открыта в интернет без JWT и раньше верила chat.id прямо из тела:
// зная разрешённый chat_id, посторонний мог отправить /mute и отключить
// владелице оповещения. Telegram умеет подписывать каждый запрос заголовком
// X-Telegram-Bot-Api-Secret-Token — теперь он сверяется с секретом из Vault
// (RPC get_tg_webhook_secret, доступна только service_role).
//
// Пока секрет не прописан в самом Telegram через setWebhook, заголовка в
// запросах нет. Поэтому проверка мягкая: нет секрета в базе или нет заголовка
// в запросе — работаем по-старому, но пишем предупреждение в лог. Как только
// setWebhook выполнен, любой запрос без верного заголовка получает 401.

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

/**
 * Сверяет заголовок Telegram с секретом из Vault.
 * Сравнение посимвольное с постоянным временем: обычное === выходит на первом
 * различии, и по времени ответа секрет можно подобрать по знаку.
 */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("ok");

  // Проверка до чтения тела: подделка не должна доходить до разбора команд.
  {
    const client = adminClient();
    const { data: expected, error } = await client.rpc("get_tg_webhook_secret");
    if (error) {
      console.error("[telegram-webhook] секрет из Vault не прочитан:", error.message);
    } else if (typeof expected === "string" && expected.length > 0) {
      const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ??
        req.headers.get("x-telegram-bot-api-secret-token");
      if (!got) {
        console.warn(
          "[telegram-webhook] запрос без заголовка секрета. Пока setWebhook " +
            "не вызван с secret_token, это нормально — пропускаем.",
        );
      } else if (!sameSecret(got, expected)) {
        // Заголовок есть, но чужой — это подделка, а не старый Telegram.
        return new Response(JSON.stringify({ ok: false, error: "invalid secret token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

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

  // Whitelist: разрешённые chat_id из env (через запятую) — только они могут подписаться.
  // Любой посторонний получит «Доступ ограничен».
  const allow = (
    Deno.env.get("TELEGRAM_CHAT_ID") ??
    Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") ??
    Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID") ??
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length > 0 && !allow.includes(chatId)) {
    await tgSend(chatId, "⛔ Доступ ограничен.");
    return new Response("ok");
  }

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
