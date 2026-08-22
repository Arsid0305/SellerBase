// telegram-indices-reminder — Пн 06:00 UTC (09:00 МСК) шлёт напоминание внести
// индексы локализации и распределения продаж, если за прошлую неделю записи нет.
// Пропускает если запись за прошлую неделю уже создана.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

function isoLastMonday(): string {
  const d = new Date();
  const dow = d.getUTCDay();
  const shift = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - shift - 7);
  return d.toISOString().slice(0, 10);
}

async function sendTelegram(text: string): Promise<void> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID");
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set");
  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!resp.ok) throw new Error(`telegram ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cron = checkCronSecret(req);
  if (!cron.ok) return cron.response;

  const supabase = adminClient();
  try {
    const lastMonday = isoLastMonday();
    const { data } = await supabase
      .from("wb_personal_indices")
      .select("week_start")
      .eq("week_start", lastMonday)
      .maybeSingle();

    if (data) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "запись за прошлую неделю уже есть" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const msg = [
      "🗓 <b>Пн — внести индексы за прошлую неделю</b>",
      "",
      `Неделя: <b>${lastMonday}</b>`,
      "",
      "WB не отдаёт эти цифры через API, введи руками:",
      "",
      "1. Открой ЛК WB → Аналитика → <b>Индекс локализации</b>",
      "2. Открой ЛК WB → Аналитика → <b>Индекс распределения продаж</b>",
      "3. Внеси в проге: <b>/tariffs → Внести значения из ЛК WB</b>",
      "",
      "Значения обновляются ночью с Вс на Пн по MSK.",
    ].join("\n");

    await sendTelegram(msg);
    // ingestion_log, а не integration_jobs: последней в схеме нет, запись падала
    // молча, и задачу не видели ни v_data_quality, ни telegram-alerts.
    const nowIso = new Date().toISOString();
    await supabase.from("ingestion_log").insert({
      job_name: "telegram-indices-reminder",
      status: "ok",
      started_at: nowIso,
      finished_at: nowIso,
      rows_in: 1,
      rows_out: 1,
      meta: { week: lastMonday },
    });

    return new Response(JSON.stringify({ ok: true, sent: true, week: lastMonday }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errIso = new Date().toISOString();
    await supabase.from("ingestion_log").insert({
      job_name: "telegram-indices-reminder", status: "error",
      started_at: errIso, finished_at: errIso,
      rows_in: 0, rows_out: 0, error_text: msg, meta: {},
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
