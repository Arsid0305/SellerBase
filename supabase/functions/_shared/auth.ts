// Защита cron-edge-functions через shared secret header.
// pg_cron вызывает функции через net.http_post, добавляя заголовок X-Cron-Secret.
// Любой внешний вызов без правильного header → 401.
//
// Альтернатива verify_jwt=true (которая требует service_role JWT и не работает в pg_cron
// без app.settings.service_role_key). Решение из аудита 2026-06-20 пункт 🔴 #2.

export function checkCronSecret(req: Request): { ok: true } | { ok: false; response: Response } {
  const expected = Deno.env.get("CRON_SHARED_SECRET");

  // Если секрет не задан в env — пропускаем (dev/обратная совместимость).
  // В проде ОБЯЗАТЕЛЬНО задать через `supabase secrets set CRON_SHARED_SECRET=<long-random>`.
  if (!expected) return { ok: true };

  const got = req.headers.get("X-Cron-Secret") ?? req.headers.get("x-cron-secret");
  if (got === expected) return { ok: true };

  return {
    ok: false,
    response: new Response(
      JSON.stringify({ ok: false, error: "unauthorized: invalid or missing X-Cron-Secret" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    ),
  };
}
