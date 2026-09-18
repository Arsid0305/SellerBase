// fetch-ozon-actions — акции Ozon и товары, которые в них заведены.
//
// Шаг четвёртый подключения Ozon, план — docs/integrations/OZON_PODKLYUCHENIE.md.
//
// Ozon устроил акции иначе, чем ВБ. Главная механика называется «эластичный
// бустинг»: цену продавец ставит сам в заданной вилке, и чем ниже цена, тем
// выше площадка показывает товар. Проверено 18.09.2026 на живых данных:
// товар за 643 ₽ получает продвижение 15, за 545 ₽ — уже 55.
//
// Поэтому здесь пишется не только акционная цена, но и бустинг: без него в
// акции видно только цену, и решать «ронять ли» не из чего.
//
// Товары тянем только по тем акциям, где участвуем: по остальным Ozon их
// просто не отдаёт.
//
// На площадку не пишет ничего: у ключа права «Admin read only».

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-ozon-actions";
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
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Описание акции приходит вёрсткой. Тегами в таблице делать нечего.
function bezTegov(s: unknown): string | null {
  if (typeof s !== "string" || !s) return null;
  return s.replace(/<[^>]*>/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}

interface Action {
  id?: number;
  title?: string;
  action_type?: string;
  date_start?: string;
  date_end?: string;
  freeze_date?: string;
  is_participating?: boolean;
  participating_products_count?: number;
  potential_products_count?: number;
  banned_products_count?: number;
  discount_type?: string;
  discount_value?: number;
  description?: string;
}

interface ActionProduct {
  id?: number;
  price?: number;
  action_price?: number;
  max_action_price?: number;
  add_mode?: string;
  stock?: number;
  current_boost?: number;
  max_boost?: number;
  price_max_elastic?: number;
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

    const respA = await fetch(`${OZON_BASE}/v1/actions`, { method: "GET", headers });
    const textA = await respA.text();
    if (!respA.ok) throw new Error(`actions ${respA.status}: ${textA.slice(0, 200)}`);
    const akcii = (JSON.parse(textA) as { result?: Action[] }).result ?? [];

    const akciiRows = akcii
      .filter((a) => a.id != null)
      .map((a) => ({
        action_id: a.id,
        title: (a.title ?? "").trim() || null,
        action_type: a.action_type ?? null,
        date_start: a.date_start || null,
        date_end: a.date_end || null,
        freeze_date: a.freeze_date || null,
        uchastvuem: a.is_participating ?? null,
        tovarov_uchastvuet: a.participating_products_count ?? null,
        tovarov_mozhno: a.potential_products_count ?? null,
        tovarov_zapreshcheno: a.banned_products_count ?? null,
        discount_type: a.discount_type ?? null,
        discount_value: num(a.discount_value),
        opisanie: bezTegov(a.description),
        fetched_at: new Date().toISOString(),
      }));

    if (akciiRows.length > 0) {
      const { error } = await supabase
        .from("ozon_actions")
        .upsert(akciiRows, { onConflict: "action_id" });
      if (error) throw new Error(`ozon_actions upsert: ${error.message}`);
    }

    const tovary: Record<string, unknown>[] = [];
    const uchastvuem = akcii.filter((a) => a.id != null && a.is_participating);

    for (const a of uchastvuem) {
      let lastId = "";
      for (;;) {
        await sleep(PAUSE_MS);
        const resp = await fetch(`${OZON_BASE}/v1/actions/products`, {
          method: "POST",
          headers,
          // last_id именно строкой: числом Ozon отвечает 400.
          body: JSON.stringify({ action_id: a.id, limit: PAGE, last_id: lastId }),
        });
        const text = await resp.text();
        if (!resp.ok) throw new Error(`actions/products ${resp.status}: ${text.slice(0, 200)}`);

        const r = (JSON.parse(text) as {
          result?: { products?: ActionProduct[]; last_id?: string };
        }).result ?? {};
        const products = r.products ?? [];

        for (const p of products) {
          if (p.id == null) continue;
          tovary.push({
            action_id: a.id,
            product_id: p.id,
            akcionnaya_cena: num(p.action_price),
            max_cena_akcii: num(p.max_action_price),
            ostatok: p.stock ?? null,
            dobavlen_kak: p.add_mode ?? null,
            busting_seychas: p.current_boost ?? null,
            busting_max: p.max_boost ?? null,
            cena_dlya_max_busting: num(p.price_max_elastic),
            fetched_at: new Date().toISOString(),
          });
        }

        lastId = r.last_id ?? "";
        if (!lastId || products.length < PAGE) break;
      }
    }

    // Артикул Ozon здесь не отдаёт, только числовой product_id —
    // подставляем артикул из справочника цен.
    if (tovary.length > 0) {
      const { data: spravochnik } = await supabase
        .from("ozon_prices")
        .select("product_id, offer_id");
      const poId = new Map(
        ((spravochnik ?? []) as { product_id: number; offer_id: string | null }[])
          .map((r) => [r.product_id, r.offer_id]),
      );
      for (const t of tovary) t.offer_id = poId.get(t.product_id as number) ?? null;

      for (let i = 0; i < tovary.length; i += 500) {
        const { error } = await supabase
          .from("ozon_action_products")
          .upsert(tovary.slice(i, i + 500), { onConflict: "action_id,product_id" });
        if (error) throw new Error(`ozon_action_products upsert: ${error.message}`);
      }
    }

    // Сколько товаров Ozon предлагает добавить в акции, где мы ещё не участвуем.
    const mozhno_zavesti = akcii
      .filter((a) => !a.is_participating)
      .reduce((s, a) => s + (a.potential_products_count ?? 0), 0);

    const result = {
      ok: true,
      akciy: akciiRows.length,
      uchastvuem: uchastvuem.length,
      tovarov_v_akciyah: tovary.length,
      mozhno_zavesti,
    };

    if (jobId) {
      await supabase.from("ingestion_log").update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_out: akciiRows.length + tovary.length,
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
