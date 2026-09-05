// create-wb-supply — создание FBW-поставки из плана supply_plans.
// API: POST supplies-api.wildberries.ru/api/v1/supplies
//      Body: { name }
// Затем POST /api/v1/supplies/{id}/orders — добавить товары (по barcode + qty).
// Категория токена: «Поставки» / FBW write. Env: WB_TOKEN_WRITE ?? WB_TOKEN_READ ?? WB_API_TOKEN.
//
// Auth: verify_jwt=true (по умолчанию) — только авторизованный юзер.
// Body: { plan_id: number, warehouse_id?: number }
// После успешного WB-ответа: обновляет supply_plans.status='sent_to_ff' и
// пишет notes = 'wb_supply_id=<id>'.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const WB_BASE = "https://supplies-api.wildberries.ru";

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

type PlanItem = { sku_id: number; qty: number; barcode: string | null; wb_article: number | null; my_article: string | null };

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
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders });
  }
  const b = body as { plan_id?: number };
  if (typeof b.plan_id !== "number" || b.plan_id <= 0) {
    return new Response(JSON.stringify({ error: "plan_id required" }), { status: 400, headers: corsHeaders });
  }

  const supabase = adminClient();
  try {
    const token = Deno.env.get("WB_TOKEN_WRITE") ?? Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_* not set");

    // 1. Читаем план и позиции.
    const { data: plan, error: planErr } = await supabase
      .from("supply_plans")
      .select("id, name, status")
      .eq("id", b.plan_id)
      .single();
    if (planErr || !plan) throw new Error(`plan not found: ${planErr?.message ?? b.plan_id}`);
    if (plan.status === "sent_to_ff" || plan.status === "received") {
      throw new Error(`план уже отправлен (status=${plan.status})`);
    }

    const { data: itemsRaw, error: itemsErr } = await supabase
      .from("supply_plan_items")
      .select("sku_id, qty, sku_catalog(barcode, wb_article, my_article)")
      .eq("plan_id", b.plan_id);
    if (itemsErr) throw new Error(`items: ${itemsErr.message}`);

    type ItemJoined = { sku_id: number; qty: number; sku_catalog: { barcode: string | null; wb_article: number | null; my_article: string | null } | null };
    const items: PlanItem[] = ((itemsRaw ?? []) as ItemJoined[]).map((r) => ({
      sku_id: r.sku_id,
      qty: r.qty,
      barcode: r.sku_catalog?.barcode ?? null,
      wb_article: r.sku_catalog?.wb_article ?? null,
      my_article: r.sku_catalog?.my_article ?? null,
    }));
    const withoutBarcode = items.filter((i) => !i.barcode);
    if (withoutBarcode.length > 0) {
      throw new Error(`${withoutBarcode.length} позиций без barcode — не отправить в WB`);
    }
    const validItems = items.filter((i) => i.barcode && i.qty > 0);
    if (validItems.length === 0) throw new Error("нет валидных позиций");

    // 2. Создаём поставку в WB.
    const createResp = await fetch(`${WB_BASE}/api/v1/supplies`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ name: plan.name }),
    });
    const createText = await createResp.text();
    if (!createResp.ok) {
      throw new Error(`WB create ${createResp.status}: ${createText.slice(0, 500)}`);
    }
    let createJson: { id?: string } | null = null;
    try { createJson = JSON.parse(createText); } catch { /* empty */ }
    const supplyId = createJson?.id;
    if (!supplyId) throw new Error(`WB не вернул id: ${createText.slice(0, 300)}`);

    // 3. Добавляем товары (WB требует по одному ордеру).
    // Формат: POST /api/v3/supplies/{supplyId}/orders/{orderId} — но это FBS.
    // Для FBW достаточно /api/v1/supplies/{id}/goods PUT.
    const goodsPayload = validItems.map((i) => ({ barcode: i.barcode as string, quantity: i.qty }));
    const goodsResp = await fetch(`${WB_BASE}/api/v1/supplies/${encodeURIComponent(supplyId)}/goods`, {
      method: "PUT",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ goods: goodsPayload }),
    });
    let goodsWarning: string | null = null;
    if (!goodsResp.ok) {
      goodsWarning = `WB goods ${goodsResp.status}: ${(await goodsResp.text()).slice(0, 300)}`;
    }

    // 4. Обновляем план.
    await supabase
      .from("supply_plans")
      .update({
        status: "sent_to_ff",
        notes: `wb_supply_id=${supplyId}${goodsWarning ? ` · WARN: ${goodsWarning}` : ""}`,
      })
      .eq("id", b.plan_id);

    await supabase.from("integration_jobs").insert({
      job_name: "create-wb-supply",
      status: "success",
      rows_affected: validItems.length,
      message: `plan=${b.plan_id} wb_supply=${supplyId}${goodsWarning ? ` warn=${goodsWarning}` : ""}`,
    });

    return new Response(
      JSON.stringify({ ok: true, wb_supply_id: supplyId, items_sent: validItems.length, goods_warning: goodsWarning }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("integration_jobs").insert({
      job_name: "create-wb-supply", status: "error", rows_affected: 0, message: `plan=${b.plan_id} ${msg}`,
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
