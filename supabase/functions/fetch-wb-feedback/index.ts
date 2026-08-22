// fetch-wb-feedback — фетч отзывов WB.
// API: GET https://feedbacks-api.wildberries.ru/api/v1/feedbacks?take=5000&skip=<>&isAnswered=<bool>
// Категория токена: «Вопросы и отзывы». Env: WB_TOKEN_READ ?? WB_API_TOKEN.
// Идемпотентно: UPSERT в wb_reviews_fact по id.
// Тянем и отвеченные, и неотвеченные, по 5000 (WB max).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-feedback";
const WB_BASE = "https://feedbacks-api.wildberries.ru";
const PAGE_LIMIT = 5000;

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

interface WbFeedbackAnswer {
  text?: string;
  createDate?: string;
  state?: string;
}

interface WbFeedbackDetails {
  nmId?: number;
  imtId?: number;
  productName?: string;
  supplierArticle?: string;
  brandName?: string;
}

interface WbFeedback {
  id: string;
  productValuation: number;
  createdDate: string;
  updatedDate?: string;
  state?: string;
  text?: string;
  pros?: string;
  cons?: string;
  userName?: string;
  photoLinks?: Array<{ fullSize?: string; miniSize?: string }>;
  video?: { link?: string; uri?: string } | null;
  wasViewed?: boolean;
  answer?: WbFeedbackAnswer | null;
  productDetails?: WbFeedbackDetails;
}

interface WbFeedbackResponse {
  data?: { feedbacks?: WbFeedback[] };
}

async function fetchPage(token: string, isAnswered: boolean, skip: number): Promise<WbFeedback[]> {
  const url = `${WB_BASE}/api/v1/feedbacks?take=${PAGE_LIMIT}&skip=${skip}&isAnswered=${isAnswered}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { Authorization: token },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WB feedback ${resp.status}: ${text.slice(0, 500)}`);
  }
  const json = (await resp.json()) as WbFeedbackResponse;
  return json.data?.feedbacks ?? [];
}

type ReviewRow = {
  id: string;
  nm_id: number | null;
  imt_id: number | null;
  product_name: string | null;
  supplier_article: string | null;
  brand_name: string | null;
  rating: number;
  text: string | null;
  pros: string | null;
  cons: string | null;
  user_name: string | null;
  photo_urls: string[] | null;
  video_url: string | null;
  created_at: string;
  updated_at: string | null;
  answered: boolean;
  answer_text: string | null;
  answer_created_at: string | null;
  was_viewed: boolean;
};

function toRow(f: WbFeedback): ReviewRow | null {
  if (!f.id || !f.productValuation || !f.createdDate) return null;
  const details = f.productDetails ?? {};
  const photos = (f.photoLinks ?? []).map((p) => p.fullSize ?? p.miniSize ?? "").filter(Boolean);
  const answer = f.answer ?? null;
  return {
    id: f.id,
    nm_id: details.nmId ?? null,
    imt_id: details.imtId ?? null,
    product_name: details.productName ?? null,
    supplier_article: details.supplierArticle ?? null,
    brand_name: details.brandName ?? null,
    rating: Math.max(1, Math.min(5, Number(f.productValuation))),
    text: f.text ?? null,
    pros: f.pros ?? null,
    cons: f.cons ?? null,
    user_name: f.userName ?? null,
    photo_urls: photos.length > 0 ? photos : null,
    video_url: f.video?.link ?? f.video?.uri ?? null,
    created_at: f.createdDate,
    updated_at: f.updatedDate ?? null,
    answered: Boolean(answer && answer.text),
    answer_text: answer?.text ?? null,
    answer_created_at: answer?.createDate ?? null,
    was_viewed: Boolean(f.wasViewed),
  };
}

async function upsertBatch(supabase: SupabaseClient, rows: ReviewRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("wb_reviews_fact").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`upsert wb_reviews_fact: ${error.message}`);
}

// Логируем в ingestion_log — общий журнал всех ingestion-функций.
// Раньше писали в integration_jobs, которой в схеме нет: запись падала, а вместе
// с ней терялась и ошибка из catch. Плюс job не видели v_data_quality
// и telegram-alerts, которые читают именно ingestion_log.
async function logJob(
  supabase: SupabaseClient,
  status: "success" | "error",
  rowsAffected: number,
  message: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("ingestion_log").insert({
    job_name: JOB_NAME,
    status: status === "success" ? "ok" : "error",
    started_at: now,
    finished_at: now,
    rows_in: rowsAffected,
    rows_out: rowsAffected,
    error_text: message,
    meta: {},
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cron = checkCronSecret(req);
  if (!cron.ok) return cron.response;

  const supabase = adminClient();
  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN not set");

    let total = 0;
    for (const isAnswered of [false, true]) {
      let skip = 0;
      for (let page = 0; page < 20; page++) {
        const feedbacks = await fetchPage(token, isAnswered, skip);
        if (feedbacks.length === 0) break;
        const rows = feedbacks.map(toRow).filter((r): r is ReviewRow => r !== null);
        await upsertBatch(supabase, rows);
        total += rows.length;
        if (feedbacks.length < PAGE_LIMIT) break;
        skip += PAGE_LIMIT;
      }
    }

    await logJob(supabase, "success", total, null);
    return new Response(
      JSON.stringify({ ok: true, rowsAffected: total }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logJob(supabase, "error", 0, msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
