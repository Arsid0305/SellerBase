// fetch-wb-content — синхронизация карточек товаров с WB Content API.
// Обновляет sku_catalog (title, brand, category, photo_url) по совпадению wb_article = nmID.
// Запускается по расписанию (cron) или вручную.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-content";
const WB_BASE = "https://content-api.wildberries.ru";
const PAGE_LIMIT = 100;

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

interface WbPhoto {
  big?: string;
  c246x328?: string;
  c516x688?: string;
  tm?: string;
  square?: string;
}

interface WbCharacteristic {
  id?: number;
  name?: string;
  value?: unknown;
}

interface WbDimensions {
  length?: number;
  width?: number;
  height?: number;
  weightBrutto?: number;
}

interface WbCard {
  nmID: number;
  vendorCode?: string;
  title?: string;
  brand?: string;
  description?: string;
  subjectID?: number;
  subjectName?: string;
  rating?: number;
  reviewsCount?: number;
  photos?: WbPhoto[];
  characteristics?: WbCharacteristic[];
  dimensions?: WbDimensions;
  updatedAt?: string;
}

interface WbResponse {
  cards?: WbCard[];
  cursor?: { updatedAt?: string; nmID?: number; total?: number };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const supabase = adminClient();

  const { data: logRow, error: insErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: {} })
    .select("id")
    .single();
  if (insErr || !logRow) {
    return new Response(
      JSON.stringify({ ok: false, error: `Failed to open ingestion_log: ${insErr?.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const jobId: number = logRow.id;

  try {
    const token = Deno.env.get("WB_TOKEN_READ");
    if (!token) throw new Error("WB_TOKEN_READ is not set in function secrets");

    let cursor: Record<string, unknown> = { limit: PAGE_LIMIT };
    let totalCards = 0;
    let totalUpdated = 0;
    let pages = 0;
    const nowIso = new Date().toISOString();

    while (true) {
      pages += 1;
      const resp = await fetch(`${WB_BASE}/content/v2/get/cards/list`, {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`WB API ${resp.status}: ${text.slice(0, 500)}`);
      }
      const data = (await resp.json()) as WbResponse;
      const cards = data.cards ?? [];
      totalCards += cards.length;

      for (const card of cards) {
        if (card.nmID == null) continue;
        const photo = card.photos?.[0];
        const photoUrl = photo?.big || photo?.c516x688 || photo?.c246x328 || photo?.tm || photo?.square || null;
        const { error, count } = await supabase
          .from("sku_catalog")
          .update(
            {
              title: card.title || null,
              brand: card.brand || null,
              category: card.subjectName || null, // legacy-поле, оставлено для обратной совместимости
              subject_name: card.subjectName || null,
              // subject_id — ключ к справочнику характеристик предмета
              // (content/v2/object/charcs/{subjectId}). Без него не узнать, какие поля
              // у категории есть вообще, то есть нечем мерить незаполненность.
              subject_id: card.subjectID ?? null,
              rating: card.rating ?? null, // Content API обычно не отдаёт — останется null
              reviews_count: card.reviewsCount ?? null, // аналогично, обычно null без Feedbacks API
              photo_url: photoUrl,
              description: card.description ?? null,
              characteristics: card.characteristics ?? null,
              dimensions: card.dimensions ?? null,
              last_content_sync_at: nowIso,
            },
            { count: "exact" },
          )
          .eq("wb_article", card.nmID);
        if (!error && (count ?? 0) > 0) totalUpdated += count ?? 0;
      }

      if (cards.length < PAGE_LIMIT) break;
      const last = cards[cards.length - 1];
      cursor = { updatedAt: last.updatedAt, nmID: last.nmID, limit: PAGE_LIMIT };
    }

    await supabase
      .from("ingestion_log")
      .update({
        finished_at: new Date().toISOString(),
        status: "ok",
        meta: { totalCards, totalUpdated, pages },
      })
      .eq("id", jobId);

    return new Response(JSON.stringify({ ok: true, totalCards, totalUpdated, pages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("ingestion_log")
      .update({ finished_at: new Date().toISOString(), status: "error", meta: { error: msg } })
      .eq("id", jobId);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
