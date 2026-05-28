// sync-sheets — льёт ключевые view в Google Sheets.
// Сейчас stub: без GOOGLE_SA_JSON и GOOGLE_SHEET_ID возвращает 503.
// Полный вариант будет когда будет service account + ID таблицы.

import { adminClient } from "../_shared/supabase.ts";
import { runJob } from "../_shared/ingestion.ts";
import { corsHeaders } from "../_shared/cors.ts";

const JOB_NAME = "sync-sheets";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const saJson = Deno.env.get("GOOGLE_SA_JSON");
  const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
  if (!saJson || !sheetId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "sync-sheets not configured. Set GOOGLE_SA_JSON and GOOGLE_SHEET_ID secrets.",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = adminClient();
  const outcome = await runJob(supabase, JOB_NAME, { sheet_id: sheetId }, async () => {
    const [pnl, balance, recommend, quality] = await Promise.all([
      supabase.from("v_pnl_by_sku").select("*"),
      supabase.from("v_warehouses_balance").select("*"),
      supabase.from("v_supply_recommendation").select("*"),
      supabase.from("v_data_quality").select("*"),
    ]);
    const errors = [pnl, balance, recommend, quality].filter((r) => r.error).map((r) => r.error?.message);
    if (errors.length) throw new Error(`Supabase select errors: ${errors.join("; ")}`);

    // TODO: реальный запись в Google Sheets API через sheetId + service account.
    // Сейчас — вернём размеры сверок, чтобы было видно что функция живая.
    return {
      rows_in: 0,
      rows_out: (pnl.data?.length ?? 0) + (balance.data?.length ?? 0)
        + (recommend.data?.length ?? 0) + (quality.data?.length ?? 0),
      result: {
        pnl: pnl.data?.length ?? 0,
        balance: balance.data?.length ?? 0,
        recommend: recommend.data?.length ?? 0,
        quality: quality.data?.length ?? 0,
      },
    };
  });

  return new Response(JSON.stringify(outcome), {
    status: outcome.ok ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
