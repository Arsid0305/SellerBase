// set-wb-price — установка новой цены WB через discounts-prices-api.
// POST /api/v2/upload/task, body: { data: [{ nmID, price, discount }] }
// Возвращает { taskId } — можно потом опросить статус через /history/tasks.
// Категория токена: «Цены и скидки». Env: WB_TOKEN_READ ?? WB_API_TOKEN.
//
// Auth: verify_jwt=true (по умолчанию) — только авторизованный юзер.
// В отличие от cron-фетчей CRON_SHARED_SECRET здесь НЕ используется.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const WB_BASE = "https://discounts-prices-api.wildberries.ru";

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

type PriceUpdate = {
  nmID: number;
  price: number;
  discount: number;
};

function isValidUpdate(u: unknown): u is PriceUpdate {
  if (!u || typeof u !== "object") return false;
  const o = u as Record<string, unknown>;
  return (
    typeof o.nmID === "number" && o.nmID > 0 &&
    typeof o.price === "number" && o.price > 0 &&
    typeof o.discount === "number" && o.discount >= 0 && o.discount <= 90
  );
}

// ⛔ ЗАПИСЬ НА WB ОТКЛЮЧЕНА — решение владелицы 05.09.2026:
// «абсолютно все записи на ВБ отменяются, только ручные».
//
// Функция оставлена в репозитории, но ничего не отправляет: любой вызов
// возвращает 403. Включать обратно — только по прямому распоряжению владелицы
// и не раньше, чем будут закрыты три вещи, найденные аудитом 04.09:
//   1) отдельный WB_TOKEN_WRITE вместо read-токена;
//   2) существующая таблица журнала операций (аудит писался в integration_jobs,
//      которой в схеме нет, — след действия терялся);
//   3) проверка фактического результата на стороне WB, а не «ok» по факту
//      отправки запроса.
const WRITE_TO_WB_DISABLED = true;
const WRITE_DISABLED_RESPONSE = {
  ok: false,
  error: "Запись на Wildberries отключена решением владелицы 05.09.2026. " +
    "Цены и поставки заводятся вручную в кабинете.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (WRITE_TO_WB_DISABLED) {
    return new Response(JSON.stringify(WRITE_DISABLED_RESPONSE), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = body as { data?: unknown[] };
  if (!Array.isArray(raw?.data) || raw.data.length === 0 || raw.data.length > 1000) {
    return new Response(JSON.stringify({ error: "data must be array of 1..1000 items" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const updates = raw.data.filter(isValidUpdate);
  if (updates.length !== raw.data.length) {
    return new Response(JSON.stringify({ error: "invalid item in data (nmID>0, price>0, discount 0..90)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN not set in function secrets");

    const wbResp = await fetch(`${WB_BASE}/api/v2/upload/task`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: updates }),
    });

    const text = await wbResp.text();
    if (!wbResp.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `WB ${wbResp.status}: ${text.slice(0, 500)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* WB иногда возвращает пустое тело */ }
    const taskId = (json as { data?: { id?: number } } | null)?.data?.id ?? null;

    // Логируем в integration_jobs для аудита.
    const supabase = adminClient();
    await supabase.from("integration_jobs").insert({
      job_name: "set-wb-price",
      status: "success",
      rows_affected: updates.length,
      message: taskId ? `taskId=${taskId}` : "ok",
    });

    return new Response(
      JSON.stringify({ ok: true, taskId, updated: updates.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
