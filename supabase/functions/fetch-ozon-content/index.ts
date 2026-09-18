// fetch-ozon-content — содержание карточек Ozon: название, описание,
// характеристики, фото, габариты.
//
// Просьба владелицы 18.09.2026: «ещё бы создать отпечаток карточек с озона
// как мы с вб сделали, чтоб потом определять показатели сео».
//
// Два метода площадки, оба проверены живым запросом:
//   /v4/product/info/attributes  — характеристики, габариты, фото, название;
//   /v1/product/info/description — описание, по одному товару за запрос.
//
// Описание приходится брать поштучно: списком Ozon его не отдаёт. Поэтому
// функция идёт с паузой и раз в день, а не дважды.
//
// Пишет в ozon_content (текущий срез). Отпечаток на дату снимается отдельно,
// в ozon_content_snapshots, и только по случаю: перед правками и после.
//
// На площадку не пишет ничего: у ключа права «Admin read only».

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-ozon-content";
const OZON_BASE = "https://api-seller.ozon.ru";
const PAGE = 100;
const PAUSE_MS = 400;

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
const int = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

interface Attr {
  attribute_id?: number;
  values?: { value?: string }[];
}

interface CardAttributes {
  id?: number;
  offer_id?: string;
  name?: string;
  barcode?: string;
  height?: number;
  width?: number;
  depth?: number;
  weight?: number;
  description_category_id?: number;
  type_id?: number;
  primary_image?: string;
  images?: string[];
  attributes?: Attr[];
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

    // Характеристики и фото — списком, постранично.
    const cards: CardAttributes[] = [];
    let lastId = "";
    for (;;) {
      const resp = await fetch(`${OZON_BASE}/v4/product/info/attributes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filter: { visibility: "ALL" },
          limit: PAGE,
          last_id: lastId,
        }),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`product/info/attributes ${resp.status}: ${text.slice(0, 200)}`);

      const data = JSON.parse(text) as { result?: CardAttributes[]; last_id?: string };
      const items = data.result ?? [];
      cards.push(...items);

      lastId = data.last_id ?? "";
      if (!lastId || items.length < PAGE) break;
      await sleep(PAUSE_MS);
    }

    // Описания — по одному товару за запрос: списком площадка их не отдаёт.
    const opisaniya = new Map<number, string>();
    for (const c of cards) {
      if (!c.offer_id) continue;
      await sleep(PAUSE_MS);
      const resp = await fetch(`${OZON_BASE}/v1/product/info/description`, {
        method: "POST",
        headers,
        body: JSON.stringify({ offer_id: c.offer_id }),
      });
      if (!resp.ok) continue; // молча пропускаем: карточка без описания не повод ронять загрузку
      const data = JSON.parse(await resp.text()) as {
        result?: { id?: number; description?: string };
      };
      const id = data.result?.id;
      const opisanie = data.result?.description;
      if (id != null && opisanie) opisaniya.set(id, opisanie);
    }

    const rows = cards
      .filter((c) => c.id != null)
      .map((c) => ({
        product_id: c.id,
        offer_id: c.offer_id ?? null,
        name: c.name ?? null,
        description: opisaniya.get(c.id as number) ?? null,
        barcode: c.barcode ?? null,
        category_id: c.description_category_id ?? null,
        type_id: c.type_id ?? null,
        primary_image: c.primary_image ?? null,
        images_count: (c.images ?? []).length,
        height_mm: int(c.height),
        width_mm: int(c.width),
        depth_mm: int(c.depth),
        weight_g: int(c.weight),
        attributes: c.attributes ?? null,
        attributes_count: (c.attributes ?? []).length,
        fetched_at: new Date().toISOString(),
      }));

    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase
        .from("ozon_content")
        .upsert(rows.slice(i, i + 200), { onConflict: "product_id" });
      if (error) throw new Error(`ozon_content upsert: ${error.message}`);
    }

    const bez_opisaniya = rows.filter((r) => !r.description).length;
    const result = {
      ok: true,
      kartochek: rows.length,
      s_opisaniem: rows.length - bez_opisaniya,
      bez_opisaniya,
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
