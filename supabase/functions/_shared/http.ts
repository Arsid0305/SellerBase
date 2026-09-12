/**
 * Шлюз иногда отвечает 504 на первый запрос свежезапущенной функции.
 *
 * 12.09.2026. В сводке владелицы строка «Заказы вчера» пришла как «не удалось
 * посчитать». По логам шлюза видно ровно одно обращение и ровно один отказ:
 *
 *     GET /rest/v1/wb_orders_fact?select=price_with_disc,is_cancel&date=gte… → 504
 *
 * Запрос дешёвый: 829 строк, индекс по дате на месте, за вчера всего пять
 * записей. За сутки таких отказов около тридцати, и они не случайны — почти
 * все приходятся на ПЕРВОЕ обращение к базе после старта функции по
 * расписанию: try_job_lock, clean_stale_running_jobs, ingestion_log,
 * anomaly_state, wb_orders_fact. Дело не в запросе, а в первом соединении.
 *
 * Лечится повтором. Клиент supabase-js такой отказ не бросает, а возвращает
 * в поле error, поэтому обёртка withRetry из ingestion.ts до него не
 * добирается — повтор нужен уровнем ниже, в самом fetch.
 *
 * Повторяются только GET и HEAD. POST не повторяется намеренно: 504 означает,
 * что ответ потерян, а не что запрос не выполнен. Вставка могла пройти, и
 * слепой повтор создал бы вторую запись — ровно та беда, от которой
 * openJobLog в ingestion.ts защищается меткой run_key. Отказ POST-запросов
 * (try_job_lock, clean_stale_running_jobs) сбор данных не роняет: runJob
 * продолжает работу без advisory-блокировки и пишет об этом в консоль.
 */
const RETRY_STATUSES = new Set([408, 502, 503, 504]);
const RETRY_ATTEMPTS = 3;
const RETRY_PAUSE_MS = [400, 1200];

function isRetriableMethod(input: string | URL | Request, init?: RequestInit): boolean {
  // supabase-js всегда передаёт метод в init, но fetch допускает и объект
  // Request — тогда метод лежит в нём. Читаем оба, иначе POST, пришедший
  // объектом, был бы принят за GET и повторён.
  const fromRequest = typeof Request !== "undefined" && input instanceof Request ? input.method : undefined;
  const method = (init?.method ?? fromRequest ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

export async function retryingFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const last = attempt === RETRY_ATTEMPTS;
    try {
      const res = await fetch(input, init);
      if (!RETRY_STATUSES.has(res.status) || !isRetriableMethod(input, init) || last) return res;
      // Тело неудачного ответа не нужно, но оставлять его непрочитанным нельзя.
      await res.body?.cancel();
      console.warn(`[supabase] ${res.status} на попытке ${attempt} из ${RETRY_ATTEMPTS} — повтор`);
    } catch (e) {
      lastError = e;
      if (!isRetriableMethod(input, init) || last) throw e;
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`[supabase] сеть не ответила на попытке ${attempt} из ${RETRY_ATTEMPTS}: ${message} — повтор`);
    }
    await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS[attempt - 1] ?? 1200));
  }

  throw lastError instanceof Error ? lastError : new Error("supabase fetch: повторы исчерпаны");
}
