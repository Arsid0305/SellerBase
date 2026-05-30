if (!globalThis.WebSocket) globalThis.WebSocket = require('ws');
// fetch-wb-stocks — Yandex Cloud Function (Node.js 18).
// /api/v1/supplier/stocks → UPSERT wb_stocks + wb_stocks_history.
// Читает X-Ratelimit-* заголовки. На 429 ждёт X-Ratelimit-Retry и повторяет 1 раз.

const { createClient } = require('@supabase/supabase-js');

const JOB_NAME = 'fetch-wb-stocks';
const WB_BASE = 'https://statistics-api.wildberries.ru';
const MAX_RETRY_WAIT_SEC = 300; // ждём не больше 5 минут на одной попытке

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

module.exports.handler = async () => {
  const supabase = adminClient();
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: logRow, error: insErr } = await supabase
    .from('ingestion_log')
    .insert({ job_name: JOB_NAME, meta: { snapshot_date: snapshotDate, dateFrom } })
    .select('id')
    .single();
  if (insErr || !logRow) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: `Failed to open log: ${insErr?.message}` }) };
  }
  const jobId = logRow.id;
  let lastHeaders = null;

  try {
    const token = process.env.WB_API_TOKEN;
    if (!token) throw new Error('WB_API_TOKEN is not set in function env');

    const url = `${WB_BASE}/api/v1/supplier/stocks?dateFrom=${encodeURIComponent(dateFrom)}`;
    const { resp, headers } = await wbFetchWithRetry(url, token);
    lastHeaders = headers;

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`WB API ${resp.status}: ${body.slice(0, 500)}`);
    }
    const stocks = await resp.json();
    if (!Array.isArray(stocks)) throw new Error(`WB returned non-array: ${JSON.stringify(stocks).slice(0, 300)}`);

    const stocksRows = stocks.map((s) => ({
      barcode: String(s.barcode),
      nm_id: s.nmId,
      warehouse_name: s.warehouseName,
      quantity: s.quantity ?? 0,
      in_way_to_client: s.inWayToClient ?? 0,
      in_way_from_client: s.inWayFromClient ?? 0,
      last_change_date: s.lastChangeDate,
      fetched_at: new Date().toISOString(),
    }));

    if (stocksRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('wb_stocks')
        .upsert(stocksRows, { onConflict: 'barcode,warehouse_name' });
      if (upsertErr) throw new Error(`wb_stocks upsert: ${upsertErr.message}`);

      const historyRows = stocksRows.map((s) => ({
        snapshot_date: snapshotDate,
        barcode: s.barcode,
        nm_id: s.nm_id,
        warehouse_name: s.warehouse_name,
        quantity: s.quantity,
        in_way_to_client: s.in_way_to_client,
        in_way_from_client: s.in_way_from_client,
      }));
      const { error: histErr } = await supabase
        .from('wb_stocks_history')
        .upsert(historyRows, { onConflict: 'snapshot_date,barcode,warehouse_name' });
      if (histErr) throw new Error(`wb_stocks_history upsert: ${histErr.message}`);
    }

    await supabase
      .from('ingestion_log')
      .update({
        status: 'ok',
        finished_at: new Date().toISOString(),
        rows_in: stocks.length,
        rows_out: stocksRows.length,
        meta: { snapshot_date: snapshotDate, rate_limit: lastHeaders },
      })
      .eq('id', jobId);

    return { statusCode: 200, body: JSON.stringify({ ok: true, rows: stocksRows.length, snapshot_date: snapshotDate, rate_limit: lastHeaders }) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from('ingestion_log')
      .update({ status: 'error', finished_at: new Date().toISOString(), error_text: message, meta: { rate_limit: lastHeaders } })
      .eq('id', jobId);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: message, rate_limit: lastHeaders }) };
  }
};
