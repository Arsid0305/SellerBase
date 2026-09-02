// probe-wb-api — разведка официального API WB.
//
// Зачем: контракты WB меняются, а гадать по памяти дорого. Функция дёргает
// указанные пути официального API продавца и возвращает статус + начало ответа.
// Ничего не сохраняет в рабочие таблицы и ничего не пишет в WB.
//
// Строго только официальный API: хост обязан заканчиваться на wildberries.ru.
// Никакого парсинга публичной выдачи.
//
// Вызов:
//   body = {
//     "base":   "https://seller-analytics-api.wildberries.ru",
//     "method": "GET" | "POST",
//     "paths":  ["/api/v2/...", "/api/v1/..."],
//     "payload": { ... },       // тело для POST, одно на все пути
//     "snippet": 8000           // сколько знаков ответа вернуть, по умолчанию 600
//   }
//
// Результат — в ответе и в ingestion_log (meta.probe).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCronSecret } from "../_shared/auth.ts";

const JOB_NAME = "probe-wb-api";
const SNIPPET_DEFAULT = 600;
// Потолок на длину куска ответа. 600 знаков хватает, чтобы понять «работает / не работает»,
// но не хватает, чтобы увидеть структуру большого ответа целиком: разведка рич-контента
// 02.09.2026 упёрлась в обрыв на поле description. Отсюда параметр snippet в теле запроса.
const SNIPPET_MAX = 20000;
const ALLOWED_HOST_SUFFIX = ".wildberries.ru";

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

interface ProbeResult {
  path: string;
  status: number | null;
  ok: boolean;
  snippet: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = checkCronSecret(req);
  if (!gate.ok) return gate.response;

  const supabase = adminClient();
  const { data: logRow } = await supabase
    .from("ingestion_log")
    .insert({ job_name: JOB_NAME, meta: {} })
    .select("id")
    .single();
  const jobId: number = logRow?.id ?? 0;

  try {
    const token = Deno.env.get("WB_TOKEN_READ") ?? Deno.env.get("WB_API_TOKEN");
    if (!token) throw new Error("WB_TOKEN_READ is not set");

    const body = await req.json().catch(() => ({}));
    const base: string = body.base ?? "https://seller-analytics-api.wildberries.ru";
    const method: string = (body.method ?? "GET").toUpperCase();
    const paths: string[] = Array.isArray(body.paths) ? body.paths : [];
    const payload = body.payload ?? {};
    const snippetLen = Math.min(
      Math.max(Number(body.snippet ?? SNIPPET_DEFAULT) || SNIPPET_DEFAULT, 1),
      SNIPPET_MAX,
    );

    const host = new URL(base).hostname;
    if (!host.endsWith(ALLOWED_HOST_SUFFIX)) {
      throw new Error(`host ${host} is not an official WB API host`);
    }
    if (method !== "GET" && method !== "POST") {
      throw new Error(`method ${method} not allowed, use GET or POST`);
    }
    if (paths.length === 0 || paths.length > 12) {
      throw new Error("paths must contain 1..12 entries");
    }

    const results: ProbeResult[] = [];
    for (const path of paths) {
      const url = `${base}${path}`;
      try {
        const resp = await fetch(url, {
          method,
          headers: {
            Authorization: token,
            ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
          },
          ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
        });
        const text = await resp.text();
        results.push({
          path,
          status: resp.status,
          ok: resp.ok,
          snippet: text.slice(0, snippetLen),
        });
      } catch (e) {
        results.push({
          path,
          status: null,
          ok: false,
          snippet: "",
          error: e instanceof Error ? e.message : String(e),
        });
      }
      // WB не любит частые обращения — пауза между путями
      await new Promise((r) => setTimeout(r, 1200));
    }

    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in: results.length,
        rows_out: results.filter((r) => r.ok).length,
        meta: { base, method, probe: results },
      })
      .eq("id", jobId);

    return new Response(JSON.stringify({ ok: true, base, method, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("ingestion_log")
      .update({ status: "error", finished_at: new Date().toISOString(), error_text: msg })
      .eq("id", jobId);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
