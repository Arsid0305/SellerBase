/**
 * Проверка повторов для общего клиента функций.
 *
 * Функции живут в Deno, а Deno в этой среде нет. Поэтому http.ts намеренно
 * не тянет внешних зависимостей — тогда файл читается и обычным Node:
 *
 *     node --experimental-strip-types supabase/functions/_shared/http.test.ts
 *
 * Так же он запускается в CI. Настоящий fetch подменяется, сеть не нужна.
 */
import { retryingFetch } from "./http.ts";

let calls: Array<{ method: string }> = [];
function fakeFetch(sequence: Array<number | "throw">) {
  let i = 0;
  return async (_input: unknown, init?: RequestInit) => {
    calls.push({ method: (init?.method ?? "GET").toUpperCase() });
    const step = sequence[Math.min(i, sequence.length - 1)];
    i++;
    if (step === "throw") throw new Error("fetch failed");
    return new Response("ok", { status: step });
  };
}

const real = globalThis.fetch;
async function run(name: string, seq: Array<number | "throw">, init: RequestInit | undefined, expect: { calls: number; status?: number; throws?: boolean }) {
  calls = [];
  (globalThis as any).fetch = fakeFetch(seq);
  let status: number | undefined;
  let threw = false;
  try {
    const res = await retryingFetch("http://x/rest/v1/t", init);
    status = res.status;
  } catch { threw = true; }
  (globalThis as any).fetch = real;
  const okCalls = calls.length === expect.calls;
  const okOut = expect.throws ? threw : status === expect.status;
  console.log(`${okCalls && okOut ? "OK  " : "FAIL"} ${name}: попыток ${calls.length} (ждали ${expect.calls}), ${threw ? "исключение" : "статус " + status}`);
  if (!(okCalls && okOut)) process.exitCode = 1;
}

await run("GET 504 → 504 → 200: повтор помогает", [504, 504, 200], { method: "GET" }, { calls: 3, status: 200 });
await run("GET 504 всегда: отдаём последний ответ", [504], { method: "GET" }, { calls: 3, status: 504 });
await run("GET 200 сразу: без повторов", [200], { method: "GET" }, { calls: 1, status: 200 });
await run("GET 400: ошибка в данных, не повторяем", [400], { method: "GET" }, { calls: 1, status: 400 });
await run("POST 504: не повторяем", [504], { method: "POST" }, { calls: 1, status: 504 });
await run("POST сеть упала: сразу наружу", ["throw"], { method: "POST" }, { calls: 1, throws: true });
await run("GET сеть упала дважды, потом ответ", ["throw", "throw", 200], { method: "GET" }, { calls: 3, status: 200 });
await run("без init: считаем GET", [504, 200], undefined, { calls: 2, status: 200 });
