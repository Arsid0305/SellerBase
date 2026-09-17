// fetch-wb-fbs-stocks — склады продавца ВБ и заявленные на них остатки.
//
// Модель «Маркетплейс» (ФБС): товар лежит на фулфилменте, а площадке
// сообщается доступное количество. Правило владелицы 17.09.2026: «остатки на
// складах ФБС ВБ = остатки на FBS ozon = остатки ФБС на фулфилменте» - то
// есть заявляется одно и то же число обеим площадкам.
//
// Отсюда смысл этого сбора: не просто знать остаток, а видеть расхождение.
// Если ВБ знает сто штук, а Ozon восемьдесят - двадцать штук продаж на Ozon
// теряется зря, и это видно только если собирать обе стороны.
//
// Источник (проверено 17.09.2026, docs/integrations/FBS_PODKLYUCHENIE.md):
//   GET  /api/v3/warehouses      - склады продавца
//   POST /api/v3/stocks/{id}     - заявленные остатки по штрихкодам
//
// На площадку не пишет ничего: только GET и POST-запрос чтения остатков.
// Метод обновления остатков (PUT) намеренно не используется - правило
// владелицы «из программы на ВБ ничего не уходит».

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-fbs-stocks";
const WB_BASE = "https://marketplace-api.wildberries.ru";
const PARTIYA = 1000; // ВБ принимает до 1000 штрихкодов за запрос
const PAUSE_MS = 600;

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

/** Запрос к ВБ с повтором при упоре в ограничение частоты. */
async function wbFetch(url: string, token: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: token, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get("x-ratelimit-retry") ?? "10", 10);
    await sleep((retry + 1) * 1000);
    return wbFetch(url, token, body);
  }
  if (!res.ok) {
    throw new Error(`ВБ ${res.status} ${url}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

interface Sklad {
  id: number;
  name: string;
  officeId?: number;
  storeId?: number;
  cargoType?: number;
  deliveryType?: number;
  isDeleting?: boolean;
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
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN не заданы");

    const today = new Date().toISOString().slice(0, 10);
    const fetchedAt = new Date().toISOString();

    // 1. Склады продавца
    const sklady = (await wbFetch(`${WB_BASE}/api/v3/warehouses`, token)) as Sklad[];
    if (!Array.isArray(sklady)) throw new Error("ВБ вернул склады не списком");

    if (sklady.length > 0) {
      const { error } = await supabase.from("wb_seller_warehouses").upsert(
        sklady.map((w) => ({
          id: w.id,
          name: w.name,
          office_id: w.officeId ?? null,
          store_id: w.storeId ?? null,
          cargo_type: w.cargoType ?? null,
          delivery_type: w.deliveryType ?? null,
          is_deleting: w.isDeleting === true,
          fetched_at: fetchedAt,
        })),
        { onConflict: "id" },
      );
      if (error) throw new Error(`wb_seller_warehouses upsert: ${error.message}`);
    }

    // 2. Штрихкоды из каталога - по ним и спрашиваем остатки
    const { data: katalog, error: katErr } = await supabase
      .from("sku_catalog")
      .select("barcode")
      .eq("is_active", true)
      .not("barcode", "is", null)
      .range(0, 5000);
    if (katErr) throw new Error(`sku_catalog: ${katErr.message}`);

    const barkody = [...new Set(((katalog ?? []) as { barcode: string }[]).map((r) => r.barcode))];
    if (barkody.length === 0) {
      throw new Error("в каталоге нет штрихкодов - спрашивать нечего");
    }

    // 3. Остатки по каждому складу
    const rows: Record<string, unknown>[] = [];
    const poSkladam: Record<string, number> = {};

    for (const w of sklady) {
      if (w.isDeleting) continue;
      let vsego = 0;
      for (let i = 0; i < barkody.length; i += PARTIYA) {
        const partiya = barkody.slice(i, i + PARTIYA);
        const otvet = (await wbFetch(`${WB_BASE}/api/v3/stocks/${w.id}`, token, {
          skus: partiya,
        })) as { stocks?: { sku: string; amount: number }[] };

        for (const st of otvet.stocks ?? []) {
          if (!st.sku) continue;
          rows.push({
            snapshot_date: today,
            warehouse_id: w.id,
            barcode: st.sku,
            amount: st.amount ?? 0,
            fetched_at: fetchedAt,
          });
          vsego += st.amount ?? 0;
        }
        await sleep(PAUSE_MS);
      }
      poSkladam[w.name] = vsego;
    }

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from("wb_fbs_stocks")
        .upsert(rows.slice(i, i + 500), { onConflict: "snapshot_date,warehouse_id,barcode" });
      if (error) throw new Error(`wb_fbs_stocks upsert: ${error.message}`);
    }

    const result = {
      ok: true,
      skladov: sklady.length,
      sprosheno_barkodov: barkody.length,
      strok: rows.length,
      shtuk_po_skladam: poSkladam,
      na_datu: today,
    };

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
