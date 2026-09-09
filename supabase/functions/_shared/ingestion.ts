import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
 * Повтор идемпотентен: перед второй вставкой ищем уже созданную запись.
 * Иначе потерянный ответ на удавшейся вставке плодил бы дубли, а первая
 * строка висела бы в «running» до уборщика и попадала в журнал как ошибка.
 * Замечание ревью-бота на PR #300 — проверено, справедливо.
 */
export async function openJobLog(
  supabase: SupabaseClient,
  jobName: string,
  meta: Record<string, unknown>,
  attempts = 3,
): Promise<number> {
  let lastMessage = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { data, error } = await supabase
        .from("ingestion_log")
        .insert({ job_name: jobName, meta })
        .select("id")
        .single();
      if (error) throw new Error(`не удалось открыть ingestion_log: ${error.message}`);
      if (!data?.id) throw new Error("ingestion_log вернул пустой id");
      return data.id as number;
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e);
      if (!isTransient(lastMessage) || attempt === attempts) throw e;

      // Вставка могла пройти, а ответ потеряться. Слепой повтор создал бы
      // вторую строку, первая осталась бы навсегда в «running», и уборщик
      // зомби записал бы её как ошибку — то есть повтор портил бы ровно тот
      // журнал, ради которого всё и затевалось. Поэтому сначала ищем свою
      // запись: status по умолчанию «running», started_at по умолчанию now().
      // Нашли — берём её id вместо новой вставки.
      const orphan = await findOpenRun(supabase, jobName);
      if (orphan != null) {
        console.warn(`[openJobLog ${jobName}] ответ потерян, но запись ${orphan} создалась — продолжаем с ней`);
        return orphan;
      }

      console.warn(`[openJobLog ${jobName}] попытка ${attempt} из ${attempts}: ${lastMessage} — повтор`);
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw new Error(`openJobLog ${jobName}: ${lastMessage}`);
}

/** Незакрытая запись этого задания за последние две минуты — то есть наша. */
async function findOpenRun(supabase: SupabaseClient, jobName: string): Promise<number | null> {
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data, error } = await supabase
    .from("ingestion_log")
    .select("id")
    .eq("job_name", jobName)
    .eq("status", "running")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return (data[0] as { id: number }).id;
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
