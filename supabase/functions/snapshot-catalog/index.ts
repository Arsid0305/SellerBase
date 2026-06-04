// snapshot-catalog — ежедневный снимок состояния каталога в sku_snapshots.
// Берёт sku_catalog + среднюю розничную цену из wb_reports_fact за последние 7 дней.
// Идемпотентно: UPSERT по UNIQUE(sku_id, snapshot_date).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface CatalogRow {
  id: number;
  wb_article: number | null;
  title: string | null;
  brand: string | null;
  category: string | null;
  cost_price_rub: number | null;
  is_active: boolean;
}

interface FactRow {
  nm_id: number | null;
  retail_price: number | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = adminClient();
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: catalog, error: catErr } = await supabase
      .from("sku_catalog")
      .select("id, wb_article, title, brand, category, cost_price_rub, is_active")
      .range(0, 10_000);
    if (catErr) throw catErr;

    const rows = (catalog ?? []) as CatalogRow[];

    // Средняя розничная цена по nm_id за последние 7 дней.
    const { data: facts, error: factErr } = await supabase
      .from("wb_reports_fact")
      .select("nm_id, retail_price")
      .gte("rr_dt", since)
      .not("retail_price", "is", null)
      .gt("retail_price", 0);
    if (factErr) throw factErr;

    const sums = new Map<number, { sum: number; n: number }>();
    for (const f of (facts ?? []) as FactRow[]) {
      if (f.nm_id == null || f.retail_price == null) continue;
      const cur = sums.get(f.nm_id) ?? { sum: 0, n: 0 };
      cur.sum += Number(f.retail_price);
      cur.n += 1;
      sums.set(f.nm_id, cur);
    }
    const avgByNm = new Map<number, number>();
    for (const [nm, { sum, n }] of sums) {
      avgByNm.set(nm, Math.round((sum / n) * 100) / 100);
    }

    const snapshotRows = rows.map((c) => ({
      sku_id: c.id,
      snapshot_date: today,
      title: c.title,
      brand: c.brand,
      category: c.category,
      price_rub: c.wb_article != null ? (avgByNm.get(c.wb_article) ?? null) : null,
      rating: null,
      reviews_count: null,
      is_active: c.is_active,
      raw: c,
    }));

    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < snapshotRows.length; i += 500) {
      const chunk = snapshotRows.slice(i, i + 500);
      const { error: insErr } = await supabase
        .from("sku_snapshots")
        .upsert(chunk, { onConflict: "sku_id,snapshot_date" });
      if (insErr) {
        console.error("upsert chunk error:", insErr);
        errors.push(insErr.message);
      } else {
        inserted += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        ok: errors.length === 0,
        snapshot_date: today,
        count: inserted,
        total: snapshotRows.length,
        with_price: snapshotRows.filter((r) => r.price_rub != null).length,
        errors: errors.length ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
