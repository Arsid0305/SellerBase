/**
 * Проверка openJobLog — как ведёт себя открытие записи в журнале запусков,
 * когда шлюз отвечает сбоем.
 *
 * Запуск (и здесь, и в CI):
 *     node --experimental-strip-types supabase/functions/_shared/ingestion.test.ts
 *
 * Клиент базы подменён: сеть не нужна. Проверяется именно порядок действий —
 * сначала повторы вставки, поиск своей записи только когда попытки кончились.
 */
import { openJobLog } from "./ingestion.ts";

type Step = "504" | "ok" | "bad-data";

function fakeClient(upsertSteps: Step[], search: { rows?: Array<{ id: number }>; fails?: boolean }) {
  const calls = { upsert: 0, search: 0 };
  let i = 0;
  const client = {
    from(_table: string) {
      return {
        upsert(_row: unknown, _opts: unknown) {
          calls.upsert++;
          const step = upsertSteps[Math.min(i, upsertSteps.length - 1)];
          i++;
          return {
            select(_c: string) {
              return {
                single() {
                  if (step === "504") return Promise.resolve({ data: null, error: { message: "Gateway Timeout (504)" } });
                  if (step === "bad-data") return Promise.resolve({ data: null, error: { message: "null value in column job_name" } });
                  return Promise.resolve({ data: { id: 777 }, error: null });
                },
              };
            },
          };
        },
        select(_c: string) {
          const chain = {
            eq() { return chain; },
            limit() {
              calls.search++;
              if (search.fails) return Promise.resolve({ data: null, error: { message: "Gateway Timeout (504)" } });
              return Promise.resolve({ data: search.rows ?? [], error: null });
            },
          };
          return chain;
        },
      };
    },
  };
  return { client, calls };
}

async function run(
  name: string,
  upsertSteps: Step[],
  search: { rows?: Array<{ id: number }>; fails?: boolean },
  expect: { id?: number; throws?: boolean; upsert: number; search: number },
) {
  const { client, calls } = fakeClient(upsertSteps, search);
  let id: number | undefined;
  let threw = false;
  try {
    id = await openJobLog(client as never, "fetch-wb-tariffs", {});
  } catch { threw = true; }
  const ok = calls.upsert === expect.upsert && calls.search === expect.search &&
    (expect.throws ? threw : id === expect.id);
  console.log(`${ok ? "OK  " : "FAIL"} ${name}: вставок ${calls.upsert} (ждали ${expect.upsert}), поисков ${calls.search} (ждали ${expect.search}), ${threw ? "исключение" : "id " + id}`);
  if (!ok) process.exitCode = 1;
}

await run("вставка прошла сразу", ["ok"], {}, { id: 777, upsert: 1, search: 0 });
await run("сбой, потом успех: поиск не нужен", ["504", "ok"], {}, { id: 777, upsert: 2, search: 0 });
await run("сбой трижды, запись всё же создалась", ["504"], { rows: [{ id: 42 }] }, { id: 42, upsert: 3, search: 1 });
await run("сбой трижды, записи нет", ["504"], { rows: [] }, { throws: true, upsert: 3, search: 1 });
// Поиск ведёт собственные повторы (withRetry внутри findRunByKey), поэтому
// обращений к базе три, а не одно.
await run("сбой трижды, и поиск тоже сбоит", ["504"], { fails: true }, { throws: true, upsert: 3, search: 3 });
await run("ошибка в данных: без повторов и без поиска", ["bad-data"], {}, { throws: true, upsert: 1, search: 0 });
