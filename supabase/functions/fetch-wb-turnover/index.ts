// fetch-wb-turnover — DEPRECATED.
// WB endpoint /api/v1/turnover-dynamics/daily-dynamics возвращает 404 — был удалён в WB API.
// Данные по оборачиваемости теперь считаются из view `v_turnover_by_sku` (stocks + sales за 28 дней).
// Файл оставлен в репо чтобы deploy.yml перезаписал прод-функцию заглушкой, перестал писать в логи.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      ok: false,
      deprecated: true,
      message:
        "fetch-wb-turnover deprecated: WB endpoint /api/v1/turnover-dynamics/daily-dynamics removed. Use view v_turnover_by_sku instead.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
