#!/usr/bin/env python3
"""Разбор наименований из ТОП выдачи WB: схема заголовка группы.

Вход  — текстовый файл, одно наименование на строку (порядок = позиция в выдаче).
Выход — что стоит почти у всех, что вариативно, где слово стоит в строке,
        длины, и сверка с нашими наименованиями.

    python3 scripts/analyze_top50.py top50.txt
    python3 scripts/analyze_top50.py top50.txt --ours nashi.txt

Правило, ради которого написан: docs/seo/card-assembly.md, источник 3 свода фактов.
"""

import argparse
import re
import sys
from collections import Counter, defaultdict

STOP = {
    "и", "в", "для", "с", "на", "по", "из", "от", "до", "the", "or", "а", "к",
    "шт", "см", "мм", "г", "кг", "мл",
}


def tokens(title):
    return [w for w in re.findall(r"[a-zA-Zа-яА-ЯёЁ0-9]+", title.lower()) if w]


def read(path):
    with open(path, encoding="utf-8") as fh:
        return [ln.strip() for ln in fh if ln.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", help="наименования из выдачи, по одному на строку")
    ap.add_argument("--ours", help="наши наименования, по одному на строку")
    ap.add_argument("--min-share", type=float, default=20.0,
                    help="порог доли, %% (по умолчанию 20)")
    args = ap.parse_args()

    titles = read(args.file)
    if not titles:
        sys.exit("Пустой файл")
    n = len(titles)

    docs = [tokens(t) for t in titles]
    share = Counter()
    first_pos = defaultdict(list)
    for words in docs:
        for i, w in enumerate(dict.fromkeys(words)):
            pass
        seen = set()
        for i, w in enumerate(words):
            if w in seen:
                continue
            seen.add(w)
            share[w] += 1
            first_pos[w].append(i + 1)

    bigrams = Counter()
    for words in docs:
        seen = set()
        for a, b in zip(words, words[1:]):
            bg = f"{a} {b}"
            if bg in seen:
                continue
            seen.add(bg)
            bigrams[bg] += 1

    lens = sorted(len(t) for t in titles)

    print(f"Наименований разобрано: {n}")
    print(f"Длина: мин {lens[0]}, медиана {lens[n // 2]}, макс {lens[-1]}, "
          f"средняя {sum(lens) / n:.0f}")
    print(f"В 40 знаков укладывается: {sum(1 for x in lens if x <= 40)} из {n}")
    print(f"В 60 знаков укладывается: {sum(1 for x in lens if x <= 60)} из {n}")

    print("\n== Слова: доля наименований и среднее место в строке ==")
    print(f"{'слово':<22}{'доля':>8}{'шт':>6}{'ср. место':>11}")
    for w, c in share.most_common():
        pct = c * 100.0 / n
        if pct < args.min_share or w in STOP:
            continue
        avg = sum(first_pos[w]) / len(first_pos[w])
        print(f"{w:<22}{pct:>7.0f}%{c:>6}{avg:>11.1f}")

    print("\n== Устойчивые пары (доля наименований) ==")
    for bg, c in bigrams.most_common(15):
        pct = c * 100.0 / n
        if pct < args.min_share:
            continue
        print(f"{bg:<34}{pct:>6.0f}%  {c}")

    core = [w for w, c in share.most_common()
            if c * 100.0 / n >= 60 and w not in STOP]
    tail = [w for w, c in share.most_common()
            if args.min_share <= c * 100.0 / n < 60 and w not in STOP]
    print("\n== Схема ==")
    print("постоянное ядро (>=60% наименований): " + (", ".join(core[:12]) or "—"))
    print("вариативная часть (%.0f–60%%): " % args.min_share
          + (", ".join(tail[:15]) or "—"))

    if args.ours:
        ours = read(args.ours)
        print("\n== Наши наименования против схемы ==")
        for t in ours:
            have = set(tokens(t))
            missing = [w for w in core if w not in have]
            mark = "OK" if not missing else "нет: " + ", ".join(missing)
            print(f"{len(t):>3}  {t}\n     {mark}")


if __name__ == "__main__":
    main()
