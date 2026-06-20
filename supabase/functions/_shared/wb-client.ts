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
 * WB возвращает до PAGE_LIMIT элементов за раз. Курсор — самый поздний lastChangeDate
 * последнего элемента + 1 секунда. Завершение когда страница меньше PAGE_LIMIT.
 *
 * @param fetchPage — функция получения одной страницы по dateFrom
 * @param getLastChangeDate — извлекает lastChangeDate из элемента
 * @param getDedupKey — уникальный ключ внутри страницы (для исключения дублей)
 * @param maxPages — защита от бесконечного цикла
 */
export async function paginateByLastChangeDate<T>(
  fetchPage: (dateFrom: string) => Promise<T[]>,
  getLastChangeDate: (item: T) => string,
  getDedupKey: (item: T) => string,
  initialDateFrom: string,
  maxPages = 50,
): Promise<T[]> {
  const seen = new Set<string>();
  const all: T[] = [];
  let cursor = initialDateFrom;

  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    if (page.length === 0) break;

    let added = 0;
    let latest = cursor;
    for (const item of page) {
      const key = getDedupKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(item);
      added++;
      const lcd = getLastChangeDate(item);
      if (lcd > latest) latest = lcd;
    }

    if (added === 0) break;

    // Сдвигаем курсор на 1 секунду вперёд от последнего lastChangeDate
    const nextDt = new Date(new Date(latest).getTime() + 1000);
    cursor = nextDt.toISOString();
  }

  return all;
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
