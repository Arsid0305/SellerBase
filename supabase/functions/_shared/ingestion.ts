import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  body: () => Promise<{ rows_in: number; rows_out: number; result: T }>,
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

  // 3. Открыть запись в ingestion_log.
  const { data: logRow, error: insErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: jobName, meta })
    .select("id")
    .single();
  if (insErr || !logRow) {
    if (gotLock) await supabase.rpc("release_job_lock", { p_job_name: jobName });
    return { ok: false, jobId: -1, error: `Failed to open ingestion_log: ${insErr?.message}` };
  }
  const jobId: number = logRow.id;

  try {
    const { rows_in, rows_out, result } = await body();
    await supabase
      .from("ingestion_log")
      .update({ status: "ok", finished_at: new Date().toISOString(), rows_in, rows_out })
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
