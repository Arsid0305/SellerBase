// Общие хелперы для fetch-wb-* функций.
// Источник: аудит 2026-06-20, пункт 🟠 #4 — 70% дубль кода между sales/orders/ads.

/**
 * GET-запрос к WB API с автоматическим retry на 429 (rate limit).
 * Использует x-ratelimit-retry header WB API (секунды).
 */
export async function wbGet(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: token, "Content-Type": "application/json" },
  });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get("x-ratelimit-retry") ?? "10", 10);
    await new Promise((r) => setTimeout(r, (retry + 1) * 1000));
    return wbGet(url, token);
  }
  if (!res.ok) {
    throw new Error(`WB API ${res.status} ${url}: ${(await res.text()).slice(0, 500)}`);
  }
  return res.json();
}

/**
 * POST-запрос к WB API с retry на 429.
 */
export async function wbPost(url: string, token: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get("x-ratelimit-retry") ?? "10", 10);
    await new Promise((r) => setTimeout(r, (retry + 1) * 1000));
    return wbPost(url, token, body);
  }
  if (!res.ok) {
    throw new Error(`WB API ${res.status} ${url}: ${(await res.text()).slice(0, 500)}`);
  }
  return res.json();
}

/**
 * Инкрементальная пагинация по lastChangeDate (для Statistics API endpoints).
 *
 * WB возвращает до pageLimit элементов за раз (по умолчанию 80_000).
 * Курсор — самый поздний lastChangeDate последнего элемента + 1 секунда.
 *
 * Завершение цикла:
 *   - страница меньше pageLimit (последняя страница);
 *   - после дедупа добавлено 0 новых элементов (все — дубли с предыдущих страниц);
 *   - достигнут maxPages (защита от бесконечного цикла).
 *
 * Per-page workflow:
 *   1. fetchPage(cursor) → page
 *   2. дедуп внутри страницы через seen Set по getDedupKey
 *   3. await onPage(uniqueItems) — здесь caller делает batchUpsert
 *   4. сдвиг курсора на max(lastChangeDate) + 1 сек
 *
 * Возвращает счётчики, не накапливает items в памяти.
 */
export async function paginateByLastChangeDate<T>(opts: {
  fetchPage: (dateFrom: string) => Promise<T[]>;
  getLastChangeDate: (item: T) => string;
  getDedupKey: (item: T) => string;
  initialDateFrom: string;
  onPage: (items: T[]) => Promise<void>;
  pageLimit?: number;
  maxPages?: number;
}): Promise<{ totalSeen: number; totalUnique: number; pages: number }> {
  const pageLimit = opts.pageLimit ?? 80_000;
  const maxPages = opts.maxPages ?? 50;
  const seen = new Set<string>();
  let cursor = opts.initialDateFrom;
  let totalSeen = 0;
  let totalUnique = 0;
  let pages = 0;

  for (let i = 0; i < maxPages; i++) {
    const page = await opts.fetchPage(cursor);
    pages++;
    if (page.length === 0) break;
    totalSeen += page.length;

    const uniqueItems: T[] = [];
    let latest = cursor;
    for (const item of page) {
      const key = opts.getDedupKey(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniqueItems.push(item);
      const lcd = opts.getLastChangeDate(item);
      if (lcd && lcd > latest) latest = lcd;
    }

    if (uniqueItems.length > 0) {
      await opts.onPage(uniqueItems);
      totalUnique += uniqueItems.length;
    }

    // Условие завершения: последняя страница или все дубли.
    if (page.length < pageLimit) break;
    if (uniqueItems.length === 0) break;

    // Сдвигаем курсор на 1 секунду вперёд от последнего lastChangeDate.
    // Формат WB Statistics API: ISO без миллисекунд.
    const nextDt = new Date(new Date(latest).getTime() + 1000);
    cursor = nextDt.toISOString().replace(/\.\d{3}Z$/, "");
  }

  return { totalSeen, totalUnique, pages };
}

/**
 * Универсальный батч-upsert в Supabase (защита от лимита размера запроса).
 */
export async function batchUpsert<R extends Record<string, unknown>>(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tableName: string,
  rows: R[],
  options: { onConflict: string; batchSize?: number } = { onConflict: "id" },
): Promise<void> {
  const size = options.batchSize ?? 500;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: options.onConflict });
    if (error) throw new Error(`upsert ${tableName} failed at offset ${i}: ${error.message}`);
  }
}
