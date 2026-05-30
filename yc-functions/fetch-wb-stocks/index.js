if (!globalThis.WebSocket) globalThis.WebSocket = require('ws');
// fetch-wb-stocks — Yandex Cloud Function (Node.js 18).
// MIGRATED 2026-05: GET /api/v1/supplier/stocks (Statistics) → POST /api/analytics/v1/stocks-report/wb-warehouses (Analytics).
// Old endpoint disabled by WB on 2026-06-23.
// Requires Personal/Service token with Analytics category.

const { createClient } = require('@supabase/supabase-js');

const JOB_NAME = 'fetch-wb-stocks';
const WB_ANALYTICS_BASE = 'https://seller-analytics-api.wildberries.ru';
const PAGE_LIMIT = 1000;
// new rate limit: 1 req/20 sec (old was 1 req/min for personal token)
const BETWEEN_PAGES_MS = 21_000;
const MAX_RETRY_WAIT_MS = 300_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env not set');
  return createClient(url, key, { auth: { persistSession: false } });
}

// WB Analytics API: POST /api/analytics/v1/stocks-report/wb-warehouses
// Docs: https://dev.wildberries.ru/en/docs/openapi/analytics (Stocks Report section)
// Response structure logged to ingestion_log.meta.first_row_sample on first run — check there if mapping breaks.
async function fetchPage(token, offset) {
  const body = {
    stockType: 'wb',       // only WB warehouses (not seller's own FBS warehouses)
    skipDeletedNm: false,  // include all active items
    offset,
    limit: PAGE_LIMIT,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(`${WB_ANALYTICS_BASE}/api/analytics/v1/stocks-report/wb-warehouses`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get('x-ratelimit-retry') || '30', 10);
      const waitMs = Math.min(retryAfter * 1000 + 1000, MAX_RETRY_WAIT_MS);
      console.log(`429 at offset=${offset}, waiting ${waitMs / 1000}s`);
      await sleep(waitMs);
      continue;
    }

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`WB API ${resp.status} at offset=${offset}: ${text.slice(0, 500)}`);
    }

    const json = await resp.json();
    return json;
  }
  throw new Error(`fetchPage: gave up after 3 attempts at offset=${offset}`);
}

// Defensive field extraction — WB may rename fields; logs sample on first run.
// Known aliases based on WB API patterns:
//   quantity   ← quantity | stockCount | stock
//   barcode    ← barcode | sku
//   nmId       ← nmId | nmID
//   warehouse  ← warehouseName | officeName
function mapRow(s, fetchedAt) {
  const barcode = String(s.barcode || s.sku || s.chrtId || '').trim();
  const warehouseName = String(s.warehouseName || s.officeName || s.warehouse || '').trim();
  return {
    barcode,
    nm_id: s.nmId ?? s.nmID ?? null,
    warehouse_name: warehouseName,
    quantity: s.quantity ?? s.stockCount ?? s.stock ?? 0,
    in_way_to_client: s.inWayToClient ?? s.toClientCount ?? 0,
    in_way_from_client: s.inWayFromClient ?? s.fromClientCount ?? 0,
    last_change_date: s.lastChangeDate || null,
    fetched_at: fetchedAt,
  };
}

// Extract rows array from different possible response envelopes.
function extractRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data?.rows)) return json.data.rows;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.data)) return json.data;
  return [];
}

function extractTotal(json) {
  return json.data?.total ?? json.total ?? json.data?.count ?? null;
}

module.exports.handler = async () => {
  const supabase = adminClient();
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const fetchedAt = new Date().toISOString();

  const { data: logRow, error: insErr } = await supabase
    .from('ingestion_log')
    .insert({ job_name: JOB_NAME, meta: { snapshot_date: snapshotDate, api: 'analytics-v1' } })
    .select('id')
    .single();
  if (insErr || !logRow) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: `Failed to open log: ${insErr?.message}` }) };
  }
  const jobId = logRow.id;
  let firstRowSample = null;
  let totalRowsIn = 0;

  try {
    const token = process.env.WB_API_TOKEN;
    if (!token) throw new Error('WB_API_TOKEN is not set in function env');

    const allStocksRows = [];
    let offset = 0;
    let pageNum = 0;

    while (true) {
      if (pageNum > 0) await sleep(BETWEEN_PAGES_MS);
      pageNum++;

      const json = await fetchPage(token, offset);
      const rows = extractRows(json);
      const total = extractTotal(json);

      if (rows.length === 0) break;

      // Log raw sample from first page to help diagnose field name changes
      if (pageNum === 1 && rows.length > 0) {
        firstRowSample = JSON.stringify(rows[0]).slice(0, 500);
        console.log(`First row sample: ${firstRowSample}`);
        console.log(`Total reported by API: ${total}`);
      }

      for (const s of rows) {
        const mapped = mapRow(s, fetchedAt);
        if (!mapped.barcode && !mapped.nm_id) continue; // skip completely empty rows
        allStocksRows.push(mapped);
      }

      totalRowsIn += rows.length;
      console.log(`Page ${pageNum}: offset=${offset}, got=${rows.length}, total=${total}, accumulated=${totalRowsIn}`);

      // Stop if we got fewer rows than the page limit (last page) or exceeded total
      if (rows.length < PAGE_LIMIT) break;
      if (total !== null && offset + rows.length >= total) break;
      offset += rows.length;
    }

    if (allStocksRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('wb_stocks')
        .upsert(allStocksRows, { onConflict: 'barcode,warehouse_name' });
      if (upsertErr) throw new Error(`wb_stocks upsert: ${upsertErr.message}`);

      const historyRows = allStocksRows.map((s) => ({
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
        rows_in: totalRowsIn,
        rows_out: allStocksRows.length,
        meta: { snapshot_date: snapshotDate, api: 'analytics-v1', pages: pageNum, first_row_sample: firstRowSample },
      })
      .eq('id', jobId);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, rows: allStocksRows.length, pages: pageNum, snapshot_date: snapshotDate }),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from('ingestion_log')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        error_text: message,
        meta: { api: 'analytics-v1', first_row_sample: firstRowSample },
      })
      .eq('id', jobId);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: message }) };
  }
};
