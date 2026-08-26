// fetch-wb-subject-charcs — справочник характеристик предметов WB.
//
// Отвечает на вопрос «какие поля вообще есть у этой категории и какие обязательны».
// Без него по карточке видно только заполненное: «10 характеристик» — а из скольки,
// неизвестно, и пропуск не с чем сравнить.
//
// Категория токена: Контент (WB_TOKEN_READ).
// Ходит только по предметам, которые реально есть в sku_catalog у активных SKU:
// у WB тысячи предметов, тянуть все незачем.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-subject-charcs";
const WB_BASE = "https://content-api.wildberries.ru";
// WB ограничивает Content API примерно 100 запросами в минуту. Предметов у нас
// десяток, но пауза оставлена намеренно: каталог может вырасти.
const REQUEST_PAUSE_MS = 700;

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface WbCharc {
  charcID?: number;
  name?: string;
  required?: boolean;
  unitName?: string;
  maxCount?: number;
  popular?: boolean;
  charcType?: number;
}

async function loadForeignPatterns(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("wb_foreign_charc_names")
    .select("name_pattern");
  if (error) throw new Error(`wb_foreign_charc_names: ${error.message}`);
  return (data ?? []).map((r) => String(r.name_pattern).toLowerCase());
}

async function fetchCharcs(token: string, subjectId: number): Promise<WbCharc[]> {
  const url = `${WB_BASE}/content/v2/object/charcs/${subjectId}?locale=ru`;
  const resp = await fetch(url, { headers: { Authorization: token } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WB charcs ${subjectId} → ${resp.status}: ${text.slice(0, 300)}`);
  }
  const json = await resp.json();
  const rows = json?.data ?? [];
  if (!Array.isArray(rows)) {
    throw new Error(`WB charcs ${subjectId}: ожидался массив, пришло ${JSON.stringify(json).slice(0, 200)}`);
  }
  return rows as WbCharc[];
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

    const { data: skuRows, error: skuErr } = await supabase
      .from("sku_catalog")
      .select("subject_id")
      .eq("is_active", true)
      .not("subject_id", "is", null);
    if (skuErr) throw new Error(`sku_catalog: ${skuErr.message}`);

    const subjectIds: number[] = [
      ...new Set<number>((skuRows ?? []).map((r) => Number((r as { subject_id: unknown }).subject_id))),
    ].sort((a, b) => a - b);
    if (subjectIds.length === 0) {
      throw new Error("у активных SKU не заполнен subject_id — сначала прогнать fetch-wb-content");
    }

    const foreignPatterns = await loadForeignPatterns(supabase);
    const fetchedAt = new Date().toISOString();
    const perSubject: Record<string, number> = {};
    let totalCharcs = 0;
    let foreignCount = 0;

    for (const subjectId of subjectIds) {
      const charcs = await fetchCharcs(token, subjectId);
      const rows = charcs
        .filter((c) => c.charcID != null && c.name)
        .map((c) => {
          const lowered = String(c.name).toLowerCase();
          const isForeign = foreignPatterns.some((p) => lowered.includes(p));
          if (isForeign) foreignCount += 1;
          return {
            subject_id: subjectId,
            charc_id: c.charcID as number,
            name: String(c.name),
            required: c.required ?? false,
            unit_name: c.unitName || null,
            max_count: c.maxCount ?? null,
            popular: c.popular ?? null,
            charc_type: c.charcType ?? null,
            is_foreign: isForeign,
            fetched_at: fetchedAt,
          };
        });

      if (rows.length > 0) {
        const { error: upErr } = await supabase
          .from("wb_subject_charcs")
          .upsert(rows, { onConflict: "subject_id,charc_id" });
        if (upErr) throw new Error(`wb_subject_charcs upsert (${subjectId}): ${upErr.message}`);
      }

      // Характеристику, которую WB убрал из предмета, удаляем: иначе ревизия будет
      // вечно требовать заполнить поле, которого в кабинете уже нет.
      const { error: pruneErr } = await supabase
        .from("wb_subject_charcs")
        .delete()
        .eq("subject_id", subjectId)
        .lt("fetched_at", fetchedAt);
      if (pruneErr) throw new Error(`wb_subject_charcs prune (${subjectId}): ${pruneErr.message}`);

      perSubject[String(subjectId)] = rows.length;
      totalCharcs += rows.length;
      await sleep(REQUEST_PAUSE_MS);
    }

    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: subjectIds.length,
        rows_out: totalCharcs,
        meta: { subjects: subjectIds.length, charcs: totalCharcs, foreign: foreignCount, per_subject: perSubject },
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, subjects: subjectIds.length, charcs: totalCharcs, foreign: foreignCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("ingestion_log")
      .update({ status: "error", finished_at: new Date().toISOString(), error_text: message })
      .eq("id", jobId);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
