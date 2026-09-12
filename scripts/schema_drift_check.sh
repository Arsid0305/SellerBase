#!/usr/bin/env bash
# Сверка рабочей базы с тем, что собирается из миграций репозитория.
#
# Правило §27 говорит: правки базы идут только через файл миграции. Правило
# держится на памяти, и забыть его легко — эта проверка ловит забытое.
#
# Как работает. С обеих баз снимается одинаковый перечень объектов
# (supabase/ci/schema-inventory.sql): таблицы с колонками, представления,
# функции, ключи, индексы. Сравниваются отпечатки строк. Всё, что есть
# в рабочей базе и чего нет в собранной из миграций, — расхождение.
#
# Известный долг на момент заведения проверки перечислен
# в supabase/ci/schema-drift-baseline.txt и проверку не роняет: иначе она
# была бы красной всегда и её перестали бы читать.
#
# Запуск:
#   PROD_DSN=postgres://... LOCAL_DSN=postgres://... scripts/schema_drift_check.sh
#
# Пароли можно передать отдельно — PROD_PASSWORD и LOCAL_PASSWORD, — чтобы
# не возиться с их кодированием внутри строки подключения.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
inventory="$here/supabase/ci/schema-inventory.sql"
baseline="$here/supabase/ci/schema-drift-baseline.txt"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

: "${PROD_DSN:?нужен PROD_DSN — строка подключения к рабочей базе}"
: "${LOCAL_DSN:?нужен LOCAL_DSN — строка подключения к базе, собранной из миграций}"

snapshot() {   # $1 — DSN, $2 — куда положить отпечатки, $3 — пароль
  PGPASSWORD="${3:-}" psql -X -q -v ON_ERROR_STOP=1 -f "$inventory" "$1" \
    | sed '/^$/d' \
    | while IFS= read -r line; do
        printf '%s\t%s\n' "$(printf '%s' "$line" | md5sum | cut -c1-8)" "$line"
      done | sort > "$2"
}

echo "Снимаю перечень с рабочей базы…"
snapshot "$PROD_DSN" "$work/prod.tsv" "${PROD_PASSWORD:-}"
echo "Снимаю перечень с базы из миграций…"
snapshot "$LOCAL_DSN" "$work/repo.tsv" "${LOCAL_PASSWORD:-}"

echo "  рабочая база:     $(wc -l < "$work/prod.tsv") объектов"
echo "  база из миграций: $(wc -l < "$work/repo.tsv") объектов"

cut -f1 "$work/repo.tsv" | sort -u > "$work/repo.h"
grep -v '^#' "$baseline" | sed '/^$/d' | sort -u > "$work/known.h"

# Есть в рабочей базе, нет в миграциях, и это не известный долг.
awk -F'\t' 'NR==FNR { seen[$0]=1; next } !($1 in seen)' \
    <(cat "$work/repo.h" "$work/known.h" | sort -u) "$work/prod.tsv" > "$work/new.tsv"

# Обратное направление: миграции создают то, чего в рабочей базе нет.
# Это не всегда ошибка (например, ограничение, которое ещё не применили),
# но знать о нём нужно.
awk -F'\t' 'NR==FNR { seen[$1]=1; next } !($1 in seen)' \
    "$work/prod.tsv" "$work/repo.tsv" > "$work/only_repo.tsv"

if [ -s "$work/only_repo.tsv" ]; then
  echo
  echo "Есть в миграциях, но нет в рабочей базе — $(wc -l < "$work/only_repo.tsv"):"
  cut -f2 "$work/only_repo.tsv" | sed 's/^/  /'
fi

if [ -s "$work/new.tsv" ]; then
  echo
  echo "НОВОЕ РАСХОЖДЕНИЕ — $(wc -l < "$work/new.tsv") объектов есть в рабочей базе,"
  echo "но их не создаёт ни одна миграция:"
  cut -f2 "$work/new.tsv" | sed 's/^/  /'
  echo
  echo "Так бывает, когда правку внесли в базу мимо файла миграции."
  echo "Правило — tasks/rules.md §27. Что делать: описать объект миграцией"
  echo "и положить её в supabase/migrations."
  exit 1
fi

echo
echo "Нового расхождения нет. Известный долг: $(wc -l < "$work/known.h") объектов."
