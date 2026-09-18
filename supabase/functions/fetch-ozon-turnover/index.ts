// fetch-ozon-turnover — оборачиваемость Ozon по товарам.
//
// Зачем: у Ozon первые недели хранение бесплатное, потом включается платное и
// очень дорогое. Правило владелицы - как только хранение стало платным,
// товар лучше скинуть даже в минус. Чтобы это решение можно было принять
// вовремя, нужно видеть заранее, какой товар к этому идёт.
//
// Ozon сам считает оборачиваемость и ставит оценку, и по этой же оценке
// начисляет хранение. Оценка GRADES_CRITICAL - хранение будет дорогим.
//
// Источник: /v1/analytics/turnover/stocks, найден перебором 17.09.2026.
// Рублей хранения по товару Ozon не отдаёт - только общей суммой за неделю.
//
// Снимок за день: история нужна, чтобы видеть, как товар сползает из зелёной
// оценки в критическую, а не только сегодняшнее состояние.
//
// На площадку не пишет ничего: у ключа права «Admin read only».

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-ozon-turnover";
const OZON_BASE = "https://api-seller.ozon.ru";
const PAGE = 100;
const PAUSE_MS = 700;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface TurnoverItem {
  sku?: number;
  offer_id?: string;
  name?: string;
  current_stock?: number;
  ads?: number;
  idc?: number;
  turnover?: number;
  idc_grade?: string;
  turnover_grade?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = adminClient();

  const { data: logRow } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME })
    .select("id")
    .single();
  const jobId: number | null = (logRow as { id: number } | null)?.id ?? null;

  try {
    const clientId = Deno.env.get("OZON_CLIENT_ID");
    const apiKey = Deno.env.get("OZON_API_KEY");
    if (!clientId || !apiKey) throw new Error("OZON_CLIENT_ID / OZON_API_KEY не заданы");
    const headers = {
      "Client-Id": clientId,
      "Api-Key": apiKey,
      "Content-Type": "application/json",
    };

    const today = new Date().toISOString().slice(0, 10);
    const rows: Record<string, unknown>[] = [];
    const seen = new Set<number>();

    for (let offset = 0; ; offset += PAGE) {
      const resp = await fetch(`${OZON_BASE}/v1/analytics/turnover/stocks`, {
        method: "POST",
        headers,
        body: JSON.stringify({ limit: PAGE, offset }),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`turnover/stocks ${resp.status}: ${text.slice(0, 200)}`);

      const data = JSON.parse(text) as { items?: TurnoverItem[] };
      const items = data.items ?? [];
      for (const it of items) {
        if (it.sku == null || seen.has(it.sku)) continue;
        seen.add(it.sku);
        rows.push({
          snapshot_date: today,
          sku: it.sku,
          offer_id: it.offer_id ?? null,
          name: it.name ?? null,
          current_stock: it.current_stock ?? null,
          ads: num(it.ads),
          idc: num(it.idc),
          turnover: num(it.turnover),
          idc_grade: it.idc_grade ?? null,
          turnover_grade: it.turnover_grade ?? null,
        });
      }
      if (items.length < PAGE) break;
      await sleep(PAUSE_MS);
    }

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from("ozon_turnover")
        .upsert(rows.slice(i, i + 500), { onConflict: "snapshot_date,sku" });
      if (error) throw new Error(`ozon_turnover upsert: ${error.message}`);
    }

    // Считаем, сколько товаров уже в критической оценке: это те, за которые
    // Ozon берёт дорого. Число попадает в журнал, чтобы рост был виден.
    const kritichnyh = rows.filter((r) => r.turnover_grade === "GRADES_CRITICAL").length;
    const result = { ok: true, tovarov: rows.length, kritichnyh, na_datu: today };

    if (jobId) {
      await supabase.from("ingestion_log").update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_out: rows.length,
        meta: result,
      }).eq("id", jobId);
    }
    return json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (jobId) {
      await supabase.from("ingestion_log").update({
        status: "error", finished_at: new Date().toISOString(), error_text: message,
      }).eq("id", jobId);
    }
    return json({ ok: false, error: message }, 500);
  }
});
