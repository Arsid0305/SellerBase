// fetch-wb-questions — фетч вопросов покупателей WB.
//
// API: GET https://feedbacks-api.wildberries.ru/api/v1/questions?take=&skip=&isAnswered=<bool>
// Категория токена: «Вопросы и отзывы». Env: WB_TOKEN_READ ?? WB_API_TOKEN.
// Идемпотентно: UPSERT в wb_questions_fact по id.
//
// Зачем отдельно от отзывов: отзыв пишут ПОСЛЕ покупки — это оценка; вопрос
// задают ДО неё — это возражение, которое мешает купить, и место ему в первых
// 150 знаках описания. Прецедент: разделение мелкой и крупной сетки у мешков
// пришло из вопросов, а не из отзывов.
//
// Контракт разведан probe-wb-api 02.09.2026, сырой ответ — в ingestion_log.meta.probe.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-questions";
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

interface WbQuestionAnswer {
  text?: string;
  createDate?: string;
  editable?: boolean;
}

interface WbQuestionDetails {
  nmId?: number;
  imtId?: number;
  productName?: string;
  supplierArticle?: string;
  brandName?: string;
}

interface WbQuestion {
  id: string;
  text?: string;
  createdDate: string;
  state?: string;
  wasViewed?: boolean;
  answer?: WbQuestionAnswer | null;
  productDetails?: WbQuestionDetails;
}

interface WbQuestionsResponse {
  data?: {
    countUnanswered?: number;
    countArchive?: number;
    questions?: WbQuestion[];
  };
  error?: boolean;
  errorText?: string;
}

async function fetchPage(token: string, isAnswered: boolean, skip: number): Promise<WbQuestion[]> {
  const url = `${WB_BASE}/api/v1/questions?take=${PAGE_LIMIT}&skip=${skip}&isAnswered=${isAnswered}`;
  const resp = await fetch(url, { method: "GET", headers: { Authorization: token } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WB questions ${resp.status}: ${text.slice(0, 500)}`);
  }
  const json = (await resp.json()) as WbQuestionsResponse;
  // WB отдаёт 200 и при логической ошибке — она лежит в теле, а не в статусе.
  if (json.error) throw new Error(`WB questions: ${json.errorText ?? "unknown error"}`);
  return json.data?.questions ?? [];
}

type QuestionRow = {
  id: string;
  nm_id: number | null;
  imt_id: number | null;
  product_name: string | null;
  supplier_article: string | null;
  brand_name: string | null;
  text: string | null;
  state: string | null;
  answered: boolean;
  answer_text: string | null;
  answer_created_at: string | null;
  answer_editable: boolean | null;
  was_viewed: boolean;
  created_at: string;
};

function toRow(q: WbQuestion): QuestionRow | null {
  if (!q.id || !q.createdDate) return null;
  const details = q.productDetails ?? {};
  const answer = q.answer ?? null;
  return {
    id: q.id,
    nm_id: details.nmId ?? null,
    imt_id: details.imtId ?? null,
    product_name: details.productName ?? null,
    supplier_article: details.supplierArticle ?? null,
    brand_name: details.brandName ?? null,
    text: q.text ?? null,
    state: q.state ?? null,
    answered: Boolean(answer && answer.text),
    answer_text: answer?.text ?? null,
    answer_created_at: answer?.createDate ?? null,
    answer_editable: answer?.editable ?? null,
    was_viewed: Boolean(q.wasViewed),
    created_at: q.createdDate,
  };
}

async function upsertBatch(supabase: SupabaseClient, rows: QuestionRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("wb_questions_fact").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`upsert wb_questions_fact: ${error.message}`);
}

// Журнал общий для всех ingestion-функций: его читают v_data_quality
// и telegram-alerts, поэтому пишем именно сюда, а не в отдельную таблицу.
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cron = checkCronSecret(req);
  if (!cron.ok) return cron.response;

  const supabase = adminClient();
  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ / WB_API_TOKEN not set");

    let total = 0;
    // Оба среза: неотвеченные — то, что горит сейчас; отвеченные — архив,
    // в котором и лежит материал для описаний (97 вопросов на 02.09.2026).
    for (const isAnswered of [false, true]) {
      let skip = 0;
      for (let page = 0; page < 20; page++) {
        const questions = await fetchPage(token, isAnswered, skip);
        if (questions.length === 0) break;
        const rows = questions.map(toRow).filter((r): r is QuestionRow => r !== null);
        await upsertBatch(supabase, rows);
        total += rows.length;
        if (questions.length < PAGE_LIMIT) break;
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
