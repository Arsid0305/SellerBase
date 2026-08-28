"""Собирает один сводный HTML на товарную группу из markdown репозитория.

Источник истины — сами файлы `docs/seo/`, артефакт лишь их рендер: разбор
(fill-plan) + заливка (descriptions) + слайды и видео (infographics). Раньше
на группу приходилось по два артефакта с расходящимся наполнением; теперь один.

Запуск:  python3 scripts/build_group_artifact.py [имя-группы ...]
Вывод:   build/artifacts/<группа>.html
"""
import html
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEO = ROOT / "docs" / "seo"
OUT = ROOT / "build" / "artifacts"

# группа -> (заголовок, подзаголовок, части). Заголовок один на все: «<группа> под ключ».
GROUPS = {
    "myachi": (
        "Мячи",
        "Массажные мячи 6 / 7 / 9 см · 15 карточек · подгруппа 103 выведена из продажи",
        [("Разбор", "fill-plan/massage-balls-106-107-109.md"),
         ("Заливка", "descriptions/myachi-106-107-109.md"),
         ("Инфографика", "infographics/myachi-106-107-109.md")],
    ),
    "massagers": (
        "Массажёры",
        "Роликовые массажёры 101 · 3 карточки · лента 110 см, три цвета",
        [("Разбор", "fill-plan/massagers-roller-101.md"),
         ("Заливка", "descriptions/massagers-roller-101.md"),
         ("Инфографика", "infographics/massagers-roller-101.md")],
    ),
    "tabletnitsy": (
        "Таблетницы",
        "Предмет 2323 · 10 карточек · три конструкции от трёх поставщиков",
        [("Разбор", "fill-plan/tabletnitsy.md"),
         ("Заливка", "descriptions/tabletnitsy.md"),
         ("Инфографика", "infographics/tabletnitsy.md")],
    ),
}

INLINE = (
    (re.compile(r"`([^`]+)`"), lambda m: "<code>%s</code>" % html.escape(m.group(1))),
    (re.compile(r"\*\*([^*]+)\*\*"), lambda m: "<b>%s</b>" % m.group(1)),
    (re.compile(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])"), lambda m: "<i>%s</i>" % m.group(1)),
    (re.compile(r"\[([^\]]+)\]\(([^)]+)\)"), lambda m: m.group(1)),  # ссылки на файлы репо — текстом
)


def inline(text):
    """Экранирует текст и разворачивает инлайновую разметку markdown."""
    out, pos = [], 0
    for m in re.finditer(r"`[^`]+`", text):
        out.append(html.escape(text[pos:m.start()]))
        out.append("<code>%s</code>" % html.escape(m.group(0)[1:-1]))
        pos = m.end()
    out.append(html.escape(text[pos:]))
    s = "".join(out)
    for pattern, repl in INLINE[1:]:
        s = pattern.sub(repl, s)
    return s


def render(md, part_id):
    """Мини-рендер markdown: заголовки, таблицы, списки, цитаты, блоки кода."""
    lines = md.split("\n")
    out, i, anchors = [], 0, []
    while i < len(lines):
        line = lines[i]

        if line.startswith("```"):
            body = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                body.append(lines[i])
                i += 1
            i += 1
            out.append('<pre class="copy">%s</pre>' % html.escape("\n".join(body)))
            continue

        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            text = line[level:].strip()
            if level == 1:          # заголовок файла — в шапке части он уже есть
                i += 1
                continue
            aid = "%s-%d" % (part_id, len(anchors))
            if level == 2:
                anchors.append((aid, text))
                out.append('<h2 id="%s">%s</h2>' % (aid, inline(text)))
            else:
                out.append("<h%d>%s</h%d>" % (min(level + 1, 6), inline(text), min(level + 1, 6)))
            i += 1
            continue

        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[i + 1]):
            head = [c.strip() for c in line.strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip("|").split("|")])
                i += 1
            out.append('<div class="scroll"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (
                "".join("<th>%s</th>" % inline(c) for c in head),
                "".join("<tr>%s</tr>" % "".join("<td>%s</td>" % inline(c) for c in r) for r in rows)))
            continue

        if line.startswith(">"):
            body = []
            while i < len(lines) and lines[i].startswith(">"):
                body.append(lines[i].lstrip(">").strip())
                i += 1
            out.append('<blockquote>%s</blockquote>' % inline(" ".join(b for b in body if b)))
            continue

        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", line)
        if m:
            ordered = not m.group(2) in ("-", "*")
            items = []
            while i < len(lines):
                mm = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", lines[i])
                if not mm:
                    if lines[i].startswith("   ") and items:   # продолжение пункта
                        items[-1] += " " + lines[i].strip()
                        i += 1
                        continue
                    break
                items.append(mm.group(3))
                i += 1
            tag = "ol" if ordered else "ul"
            out.append("<%s>%s</%s>" % (tag, "".join("<li>%s</li>" % inline(it) for it in items), tag))
            continue

        if line.strip() == "---":
            out.append("<hr>")
            i += 1
            continue

        if not line.strip():
            i += 1
            continue

        para = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#|\||>|```|---|\s*([-*]|\d+\.)\s)", lines[i]):
            para.append(lines[i])
            i += 1
        out.append("<p>%s</p>" % inline(" ".join(p.strip() for p in para)))

    return "\n".join(out), anchors


CSS = """
:root{
  --ground:#F6F4F8;--surface:#FFFFFF;--sunk:#EDE9F2;
  --ink:#1B1526;--ink-2:#443A55;--muted:#6E6382;--line:#DCD5E4;
  --accent:#6B2FBF;--accent-soft:#EBE0FA;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#120E1A;--surface:#1B1526;--sunk:#241C33;
  --ink:#EDE8F5;--ink-2:#C4BAD6;--muted:#948AA8;--line:#332943;
  --accent:#B389F5;--accent-soft:#2A1D42;}}
:root[data-theme="dark"]{
  --ground:#120E1A;--surface:#1B1526;--sunk:#241C33;
  --ink:#EDE8F5;--ink-2:#C4BAD6;--muted:#948AA8;--line:#332943;
  --accent:#B389F5;--accent-soft:#2A1D42;}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font-family:Manrope,system-ui,-apple-system,sans-serif;font-size:16.5px;line-height:1.62;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:900px;margin:0 auto;padding:0 24px 100px}
h1{font-family:Unbounded,Manrope,sans-serif;font-weight:800;font-size:clamp(28px,5vw,44px);
  line-height:1.06;letter-spacing:-.03em;margin:0 0 14px;text-wrap:balance}
h2{font-family:Unbounded,Manrope,sans-serif;font-weight:600;font-size:22px;letter-spacing:-.02em;
  margin:44px 0 14px;padding-top:18px;border-top:1px solid var(--line);text-wrap:balance}
h3{font-weight:700;font-size:17.5px;margin:30px 0 10px}
h4,h5,h6{font-weight:700;font-size:16px;margin:22px 0 8px;color:var(--ink-2)}
p{margin:0 0 13px;max-width:74ch}
b{font-weight:700}
code{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.85em;
  background:var(--sunk);padding:1px 5px;border-radius:3px}
hr{border:0;border-top:1px solid var(--line);margin:26px 0}
ul,ol{margin:0 0 14px;padding-left:22px;max-width:74ch}
li{margin:6px 0}li::marker{color:var(--muted)}
blockquote{margin:0 0 18px;padding:13px 16px;background:var(--accent-soft);
  font-size:15.5px;border-radius:4px;max-width:74ch}
blockquote p{margin:0}
.scroll{overflow-x:auto;border:1px solid var(--line);background:var(--surface);
  border-radius:4px;margin:0 0 18px}
table{border-collapse:collapse;width:100%;font-size:14.5px}
th{text-align:left;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:var(--muted);padding:11px 13px;background:var(--sunk);border-bottom:1px solid var(--line);
  white-space:nowrap}
td{padding:10px 13px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
pre.copy{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--accent);
  border-radius:4px;padding:18px 20px;margin:0 0 18px;white-space:pre-wrap;
  font-family:inherit;font-size:15.5px;line-height:1.6;overflow-x:auto}
header.head{padding:56px 0 8px}
.kicker{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  color:var(--accent);margin-bottom:16px}
.lede{color:var(--ink-2);font-size:18px;max-width:64ch;margin:0 0 22px}
nav.toc{background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:16px 18px;
  margin:0 0 10px}
nav.toc b{display:block;font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;
  color:var(--muted);margin-bottom:9px}
nav.toc a{display:block;color:var(--ink);text-decoration:none;font-size:15px;padding:3px 0;
  border-bottom:1px solid transparent}
nav.toc a:hover{border-bottom-color:var(--accent);color:var(--accent)}
nav.toc .part{margin-top:12px}
.partmark{display:flex;align-items:baseline;gap:12px;margin:64px 0 8px;padding:14px 0 0;
  border-top:3px solid var(--ink)}
.partmark span{font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent)}
.partmark em{font-style:normal;color:var(--muted);font-size:14.5px}
.partmark + h2{border-top:0;margin-top:18px;padding-top:0}
footer{margin-top:60px;padding-top:20px;border-top:1px solid var(--line);
  color:var(--muted);font-size:13.5px}
@media(max-width:560px){.wrap{padding:0 16px 70px}pre.copy{padding:14px 15px}}
"""

PART_NOTE = {
    "Разбор": "откуда взялись решения: состав группы, рынок, отзывы, фотографии",
    "Заливка": "что вносится в кабинет: наименования, значения полей, описания",
    "Инфографика": "что переделать на слайдах и в видео",
}


def build(key):
    title, subtitle, parts = GROUPS[key]
    bodies, toc = [], []
    for idx, (part, rel) in enumerate(parts):
        md = (SEO / rel).read_text(encoding="utf-8")
        body, anchors = render(md, "p%d" % idx)
        bodies.append(
            '<div class="partmark"><span>%s</span><em>%s</em></div>\n%s'
            % (html.escape(part), html.escape(PART_NOTE.get(part, "")), body))
        toc.append((part, rel, anchors))

    nav = ['<nav class="toc"><b>Что внутри</b>']
    for part, rel, anchors in toc:
        nav.append('<div class="part"><b>%s · %s</b>' % (html.escape(part), html.escape(rel)))
        for aid, text in anchors:
            nav.append('<a href="#%s">%s</a>' % (aid, inline(text)))
        nav.append("</div>")
    nav.append("</nav>")

    page = """<title>{title} под ключ</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Manrope:wght@400;500;700&family=JetBrains+Mono&display=swap">
<style>{css}</style>
<div class="wrap">
<header class="head">
  <div class="kicker">АРОЛС · одна группа — один файл</div>
  <h1>{title}</h1>
  <p class="lede">{subtitle}</p>
  {nav}
</header>
{body}
<footer>Собрано из репозитория SellerBase: {files}. Пересобирается командой
<code>python3 scripts/build_group_artifact.py {key}</code> — правки вносятся в markdown,
не в эту страницу.</footer>
</div>
""".format(title=html.escape(title), subtitle=html.escape(subtitle), css=CSS,
           nav="\n".join(nav), body="\n".join(bodies), key=key,
           files=", ".join("<code>docs/seo/%s</code>" % rel for _, rel in parts))

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / ("%s.html" % key)
    path.write_text(page, encoding="utf-8")
    return path


if __name__ == "__main__":
    keys = sys.argv[1:] or list(GROUPS)
    for k in keys:
        p = build(k)
        print("%s — %d КБ" % (p, p.stat().st_size // 1024))
