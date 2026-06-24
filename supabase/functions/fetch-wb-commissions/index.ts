// fetch-wb-commissions — забирает % комиссии WB по каждой категории товара.
// WB API: GET https://common-api.wildberries.ru/api/v1/tariffs/commission?locale=ru
// Возвращает массив объектов { kgvpMarketplace, kgvpSupplier, kgvpSupplierExpress, paidStorageKgvp, parentName, subjectName }
// UPSERT в wb_commissions_by_subject.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "fetch-wb-commissions";
const WB_URL = "https://common-api.wildberries.ru/api/v1/tariffs/commission?locale=ru";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const supabase = adminClient();
  const { data: logRow } = await supabase.from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: {} }).select("id").single();
  const jobId: number = logRow?.id ?? 0;

  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ not set");

    const resp = await fetch(WB_URL, { headers: { Authorization: token } });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`WB ${resp.status}: ${txt.slice(0, 500)}`);
    }
    const json = await resp.json();
    // deno-lint-ignore no-explicit-any
    const items: any[] = (json as { report?: unknown[] })?.report ?? (json as { data?: unknown[] })?.data ?? (Array.isArray(json) ? (json as unknown[]) : []);

    // deno-lint-ignore no-explicit-any
    const rows = items.map((it: any) => ({
      parent_name: it.parentName ?? null,
      subject_name: it.subjectName ?? null,
      subject_id: toNum(it.subjectID ?? it.subjectId),
      kgvp_marketplace: toNum(it.kgvpMarketplace),
      kgvp_supplier: toNum(it.kgvpSupplier),
      kgvp_supplier_express: toNum(it.kgvpSupplierExpress),
      paid_storage_kgvp: toNum(it.paidStorageKgvp),
      raw: it,
      fetched_at: new Date().toISOString(),
    })).filter((r: { subject_name: string | null }) => r.subject_name);

    if (rows.length > 0) {
      const { error } = await supabase.from("wb_commissions_by_subject")
        .upsert(rows, { onConflict: "subject_name" });
      if (error) throw new Error(`upsert: ${error.message}`);
    }

    await supabase.from("ingestion_log").update({
      status: "ok", finished_at: new Date().toISOString(),
      rows_in: items.length, rows_out: rows.length,
      meta: { items: items.length, raw_sample: items[0] ?? null },
    }).eq("id", jobId);

    return new Response(JSON.stringify({ ok: true, rows: rows.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("ingestion_log").update({
      status: "error", finished_at: new Date().toISOString(), error_text: msg,
    }).eq("id", jobId);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});
