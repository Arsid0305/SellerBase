if (!globalThis.WebSocket) globalThis.WebSocket = require('ws');
// fetch-wb-report — Yandex Cloud Function (Node.js 18).
// /api/v5/supplier/reportDetailByPeriod → UPSERT wb_reports_fact_raw + wb_reports_fact.
//
// Дедуп по rrd_id (уникальный ID строки), НЕ по srid! WB возвращает много строк на один srid
// (продажа + логистика + хранение + штрафы по заказу) — все с разными rrd_id.
//
// Поддержка query-параметров:
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD — явное окно
//   ?days=N — fallback
//
// Читает X-Ratelimit-* заголовки. На 429 ждёт X-Ratelimit-Retry, повторяет 1 раз.
// Между страницами пагинации — пауза 90 сек (Statistics API ~1 req/min).

const { createClient } = require('@supabase/supabase-js');

const JOB_NAME = 'fetch-wb-report';
const WB_BASE = 'https://statistics-api.wildberries.ru';
const PAGE_LIMIT = 100000;
const MAX_PAGES = 20;
const BATCH_SIZE = 1000;
const PAGE_PAUSE_MS = 90_000;
const MAX_RETRY_WAIT_SEC = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env not set');
  return createClient(url, key, { auth: { persistSession: false } });
}

function extractRateLimitHeaders(resp) {
  return {
    remaining: resp.headers.get('x-ratelimit-remaining'),
    limit: resp.headers.get('x-ratelimit-limit'),
    reset: resp.headers.get('x-ratelimit-reset'),
    retry: resp.headers.get('x-ratelimit-retry'),
  };
}

async function wbFetchWithRetry(url, token) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await fetch(url, { headers: { Authorization: token } });
    const headers = extractRateLimitHeaders(resp);
    if (resp.status !== 429) return { resp, headers };
    const retrySec = Math.min(parseInt(headers.retry || '60', 10) + 1, MAX_RETRY_WAIT_SEC);
    if (attempt === 0) {
      console.log(`429 received, X-Ratelimit-Retry=${headers.retry}, waiting ${retrySec}s`);
      await sleep(retrySec * 1000);
      continue;
    }
    return { resp, headers };
  }
  throw new Error('wbFetchWithRetry: unreachable');
}

async function upsertInBatches(supabase, table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} batch ${i}-${i + batch.length}: ${error.message}`);
  }
}

module.exports.handler = async (event) => {
  const supabase = adminClient();
  const qs = (event && event.queryStringParameters) || {};
  const explicitFrom = qs.from;
  const explicitTo = qs.to;
  const lookbackDays = parseInt(qs.days || '30', 10);

  const { data: logRow, error: insErr } = await supabase
    .from('ingestion_log')
    .insert({ job_name: JOB_NAME, meta: { from: explicitFrom, to: explicitTo, lookback_days: lookbackDays } })
    .select('id')
    .single();
  if (insErr || !logRow) return { statusCode: 500, body: JSON.stringify({ ok: false, error: `log: ${insErr?.message}` }) };
  const jobId = logRow.id;
  let lastHeaders = null;

  try {
    const token = process.env.WB_API_TOKEN;
    if (!token) throw new Error('WB_API_TOKEN is not set');

    let dateFrom;
    let dateTo;
    if (explicitFrom) {
      dateFrom = explicitFrom;
      dateTo = explicitTo || new Date().toISOString().slice(0, 10);
    } else {
      const { data: latest } = await supabase
        .from('wb_reports_fact')
        .select('rr_dt')
        .order('rr_dt', { ascending: false })
        .limit(1)
        .maybeSingle();
      dateFrom = latest?.rr_dt
        ? new Date(new Date(latest.rr_dt).getTime() - 7 * 86400 * 1000).toISOString().slice(0, 10)
        : new Date(Date.now() - lookbackDays * 86400 * 1000).toISOString().slice(0, 10);
      dateTo = new Date().toISOString().slice(0, 10);
    }

    let totalIn = 0, totalOut = 0, rrdid = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await sleep(PAGE_PAUSE_MS);

      const apiUrl = `${WB_BASE}/api/v5/supplier/reportDetailByPeriod`
        + `?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=${PAGE_LIMIT}&rrdid=${rrdid}`;
      const { resp, headers } = await wbFetchWithRetry(apiUrl, token);
      lastHeaders = headers;

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`WB API ${resp.status} page=${page}: ${body.slice(0, 500)}`);
      }
      const rows = await resp.json();
      if (!Array.isArray(rows)) throw new Error(`WB returned non-array page=${page}`);
      if (rows.length === 0) break;
      totalIn += rows.length;

      // Дедуп по rrd_id — это уникальный ключ строки отчёта!
      const rawMap = new Map();
      const factMap = new Map();
      for (const r of rows) {
        if (!r.rrd_id) continue;
        rawMap.set(r.rrd_id, { payload: r });
        factMap.set(r.rrd_id, {
          rrd_id: r.rrd_id,
          srid: r.srid,
          realizationreport_id: r.realizationreport_id,
          nm_id: r.nm_id,
          barcode: r.barcode != null ? String(r.barcode) : null,
          sa_name: r.sa_name ?? null,
          doc_type_name: r.doc_type_name ?? null,
          order_dt: r.order_dt ?? null,
          sale_dt: r.sale_dt ?? null,
          rr_dt: r.rr_dt ?? null,
          quantity: r.quantity ?? null,
          retail_price: r.retail_price ?? null,
          retail_amount: r.retail_amount ?? null,
          ppvz_for_pay: r.ppvz_for_pay ?? null,
          delivery_rub: r.delivery_rub ?? null,
          commission_rub: r.ppvz_sales_commission ?? null,
          penalty: r.penalty ?? null,
          additional_payment: r.additional_payment ?? null,
          warehouse_name: r.office_name ?? null,
        });
      }

      await upsertInBatches(supabase, 'wb_reports_fact_raw', Array.from(rawMap.values()), 'rrd_id');
      await upsertInBatches(supabase, 'wb_reports_fact', Array.from(factMap.values()), 'rrd_id');
      totalOut += factMap.size;

      if (rows.length < PAGE_LIMIT) break;
      rrdid = rows[rows.length - 1].rrd_id;
    }

    await supabase
      .from('ingestion_log')
      .update({
        status: 'ok',
        finished_at: new Date().toISOString(),
        rows_in: totalIn,
        rows_out: totalOut,
        meta: { date_from: dateFrom, date_to: dateTo, explicit: !!explicitFrom, rate_limit: lastHeaders },
      })
      .eq('id', jobId);

    return { statusCode: 200, body: JSON.stringify({ ok: true, rows_in: totalIn, rows_out: totalOut, date_from: dateFrom, date_to: dateTo, rate_limit: lastHeaders }) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from('ingestion_log')
      .update({ status: 'error', finished_at: new Date().toISOString(), error_text: message, meta: { rate_limit: lastHeaders } })
      .eq('id', jobId);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: message, rate_limit: lastHeaders }) };
  }
};
