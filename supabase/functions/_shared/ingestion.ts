import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Обёртка для фетчеров: регистрирует запуск в ingestion_log, ловит ошибки,
 * всегда пишет финальный статус. По любому исходу старые данные остаются нетронуты.
 */
export async function runJob<T>(
  supabase: SupabaseClient,
  jobName: string,
  meta: Record<string, unknown>,
  body: () => Promise<{ rows_in: number; rows_out: number; result: T }>,
): Promise<{ ok: boolean; jobId: number; error?: string; result?: T }> {
  const { data: logRow, error: insErr } = await supabase
    .from("ingestion_log")
    .insert({ job_name: jobName, meta })
    .select("id")
    .single();
  if (insErr || !logRow) {
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
  }
}
