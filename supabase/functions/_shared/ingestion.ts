// import type, а не обычный: клиент нужен здесь только как тип. Тогда файл
// читается и обычным Node — см. ingestion.test.ts.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Сбой на пути «функция → шлюз», а не отказ базы: запрос не дождался
 * свободного соединения в пуле PostgREST и был убит по таймауту (504 ровно
 * через 5 секунд, в логах PostgREST — «Thread killed by timeout manager»).
 * Такое лечится повтором; ошибка в данных — нет.
 */
export function isTransient(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("gateway timeout") ||
    m.includes("timeout") ||
    m.includes("fetch failed") ||
    m.includes("connection closed") ||
    m.includes("502") ||
    m.includes("503") ||
    m.includes("504");
}

export async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastMessage = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e);
      if (!isTransient(lastMessage) || attempt === attempts) throw e;
      console.warn(`[${label}] попытка ${attempt} из ${attempts}: ${lastMessage} — повтор`);
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw new Error(`${label}: ${lastMessage}`);
}

/**
 * Открывает запись о запуске в ingestion_log и возвращает её id.
 *
 * 09.09.2026. Раньше функции писали так:
 *
 *     const { data: logRow } = await supabase.from("ingestion_log")...
 *     const jobId: number = logRow?.id ?? 0;
 *
 * Ошибка вставки не проверялась вовсе. Когда POST в журнал получал 504,
 * logRow оказывался null, jobId становился нулём — и дальше функция делала
 * всю работу вслепую: данные собирала и записывала, а финальный
 * `.eq("id", 0)` обновлял несуществующую строку и молча ничего не менял.
 * В журнале не оставалось ни следа запуска.
 *
 * Именно так 09.09 воронка собрала 71 строку в 06:01, но проверка
 * cron-здоровья, которая смотрит в журнал, доложила «нет свежего успеха
 * 36 часов». Мониторинг соврал, хотя система работала.
 *
 * Теперь: три попытки на транзиентной ошибке, а если журнал открыть так и
 * не удалось — исключение. Пусть сбой будет виден, чем работа уйдёт в
 * тишину и мониторинг снова покажет неправду.
 *
 * Повтор идемпотентен: у каждого вызова своя метка (колонка run_key с
 * уникальным индексом), и повторная вставка с той же меткой возвращает уже
 * созданную строку. Иначе потерянный ответ на удавшейся вставке
 * плодил бы дубли, а первая строка висела бы в «running» до уборщика и
 * попадала в журнал как ошибка. Искать по имени задания и времени тоже нельзя:
 * два прогона одного задания могут идти внахлёст, и второй присвоил бы себе
 * чужую строку. Оба замечания — от ревью-бота, PR #300 и #301.
 */
export async function openJobLog(
  supabase: SupabaseClient,
  jobName: string,
  meta: Record<string, unknown>,
  attempts = 3,
): Promise<number> {
  // Метка прогона. Уходит в колонку run_key (уникальный индекс) и дублируется
  // в meta для читаемости. По ней же ищем запись, если ответ потеряется.
  // Искать по job_name и времени нельзя: openJobLog вызывают
  // и без advisory-lock, поэтому два прогона одного задания могут идти внахлёст
  // (ручной запуск поверх cron, а воронка идёт больше минуты). Тогда второй
  // подхватил бы строку первого, оба писали бы в неё, и результат того, кто
  // финишировал раньше, затёрся бы. Замечание ревью-бота на PR #301.
  const runKey = crypto.randomUUID();
  const metaWithKey = { ...meta, run_key: runKey };

  let lastMessage = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // upsert, а не insert: повтор с той же меткой вернёт уже созданную
      // строку вместо второй. Одной проверки перед повтором мало — первая
      // вставка может быть ещё в процессе, поиск честно ничего не найдёт,
      // и обе завершатся. Запрет держит база (уникальный индекс по run_key,
      // миграция 20260910160000). Замечание ревью-бота на PR #301.
      const { data, error } = await supabase
        .from("ingestion_log")
        .upsert(
          { job_name: jobName, run_key: runKey, meta: metaWithKey },
          { onConflict: "run_key" },
        )
        .select("id")
        .single();
      if (error) throw new Error(`не удалось открыть ingestion_log: ${error.message}`);
      if (!data?.id) throw new Error("ingestion_log вернул пустой id");
      return data.id as number;
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e);
      // Ошибка в данных повтору не подлежит — сразу наружу.
      if (!isTransient(lastMessage)) throw e;

      // Пока попытки есть — просто пробуем ещё раз. Повтор безопасен сам по
      // себе: метка прогона та же, а уникальный индекс по run_key не даст
      // создать вторую строку; запись либо создастся, либо вернётся уже
      // созданная.
      //
      // 12.09.2026. Раньше здесь сначала шёл поиск своей записи, и только
      // потом повтор. Поиск — тоже обращение к базе, и когда он натыкался на
      // тот же самый сбой шлюза, он не возвращал «не нашёл», а бросал
      // исключение — правильно бросал, молчаливое «записи нет» было бы хуже.
      // Но оно вылетало наружу мимо оставшихся попыток, и весь запуск
      // пропадал: ни строки в журнале, ни данных. За неделю так потерялись
      // тарифы (11.09), акции (дважды), поставки, по два часовых прогона
      // заказов, продаж и поиска аномалий. В сводке это выглядело как
      // «нет свежего успеха: fetch-wb-tariffs».
      if (attempt < attempts) {
        console.warn(`[openJobLog ${jobName}] попытка ${attempt} из ${attempts}: ${lastMessage} — повтор`);
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }

      // Попытки кончились. Последняя вставка могла пройти, а ответ потеряться,
      // и тогда строка навсегда осталась бы в «running». Ищем строго свою
      // запись — по метке прогона, а не по имени задания. Если и поиск не
      // удался, наружу уходит исходная ошибка: это не хуже прежнего поведения.
      try {
        const mine = await findRunByKey(supabase, jobName, runKey);
        if (mine != null) {
          console.warn(`[openJobLog ${jobName}] ответ потерян, но запись ${mine} создалась — продолжаем с ней`);
          return mine;
        }
      } catch (searchError) {
        const searchMessage = searchError instanceof Error ? searchError.message : String(searchError);
        console.warn(`[openJobLog ${jobName}] поиск своей записи тоже не удался: ${searchMessage}`);
      }

      throw e;
    }
  }
  throw new Error(`openJobLog ${jobName}: ${lastMessage}`);
}

/**
 * Запись именно этого вызова — по колонке run_key, она проиндексирована.
 * Возвращает null, только если записи действительно нет.
 *
 * Сбой самого поиска нельзя молча читать как «записи нет»: мы пошли бы
 * вставлять вторую строку. Дубль теперь не пройдёт — база его отобьёт, — но
 * ошибка вставки вместо честного продолжения всё равно хуже, чем повторить
 * поиск. Поэтому поиск повторяется сам, а если так и не удался — бросает.
 * Замечание ревью-бота на PR #301.
 */
async function findRunByKey(
  supabase: SupabaseClient,
  jobName: string,
  runKey: string,
): Promise<number | null> {
  return await withRetry(`findRunByKey ${jobName}`, async () => {
    const { data, error } = await supabase
      .from("ingestion_log")
      .select("id")
      .eq("run_key", runKey)
      .limit(1);
    if (error) throw new Error(`поиск записи по метке не удался: ${error.message}`);
    if (!data || data.length === 0) return null;
    return (data[0] as { id: number }).id;
  });
}

/**
 * Обёртка для фетчеров: регистрирует запуск в ingestion_log, ловит ошибки,
 * всегда пишет финальный статус. По любому исходу старые данные остаются нетронуты.
 *
 * Advisory locks (миграция 20260620110001_job_advisory_locks.sql) защищают от
 * конкурентных запусков того же job_name: если предыдущий запуск ещё не завершился,
 * новый просто пишет «skipped» в ingestion_log и выходит без ошибки.
 *
 * Зомби-записи (зависшие в running >1ч) очищаются перед каждым запуском.
 */
export async function runJob<T>(
  supabase: SupabaseClient,
  jobName: string,
  meta: Record<string, unknown>,
  body: () => Promise<{ rows_in: number; rows_out: number; result: T; meta?: Record<string, unknown> }>,
): Promise<{ ok: boolean; jobId: number; error?: string; result?: T; skipped?: boolean }> {
  // 1. Очистить зомби (running старше 1 часа без finish).
  await supabase.rpc("clean_stale_running_jobs", { p_job_name: jobName });

  // 2. Попытаться взять advisory_lock.
  let gotLock = false;
  const { data: lockResult, error: lockErr } = await supabase.rpc("try_job_lock", { p_job_name: jobName });
  if (lockErr) {
    // RPC не доступна — старая БД без миграции. Продолжаем без lock'а (fallback).
    console.warn(`[runJob ${jobName}] try_job_lock RPC недоступен: ${lockErr.message}`);
  } else if (lockResult === false) {
    // Lock занят — другой запуск держит. Логируем skipped и тихо выходим.
    await supabase.from("ingestion_log").insert({
      job_name: jobName,
      status: "skipped",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      error_text: "Skipped: another run is in progress (advisory_lock)",
      meta,
    });
    return { ok: true, jobId: -1, skipped: true };
  } else {
    gotLock = true;
  }

  // 3. Открыть запись в ingestion_log (с повтором — см. openJobLog).
  let jobId: number;
  try {
    jobId = await openJobLog(supabase, jobName, meta);
  } catch (e) {
    if (gotLock) await supabase.rpc("release_job_lock", { p_job_name: jobName });
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, jobId: -1, error: `Failed to open ingestion_log: ${message}` };
  }

  try {
    const { rows_in, rows_out, result, meta: bodyMeta } = await body();
    await supabase
      .from("ingestion_log")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        rows_in,
        rows_out,
        // Итоговые подробности прогона известны только после работы, а meta
        // при открытии записи пишется до неё — дописываем поверх.
        ...(bodyMeta ? { meta: { ...meta, ...bodyMeta } } : {}),
      })
      .eq("id", jobId);
    return { ok: true, jobId, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("ingestion_log")
      .update({ status: "error", finished_at: new Date().toISOString(), error_text: message })
      .eq("id", jobId);
    return { ok: false, jobId, error: message };
  } finally {
    if (gotLock) {
      await supabase.rpc("release_job_lock", { p_job_name: jobName });
    }
  }
}
