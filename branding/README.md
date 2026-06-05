# SellerBase Branding

Бренд-ассеты: монограмма «SB» на фоне `#0B0F17` с emerald-точкой `#10B981`.

## Файлы

- `sellerbase.ico` — иконка для Windows-ярлыка (`.bat`, `.lnk`). Multi-size 16/32/48.

Веб/PWA-иконки лежат рядом с приложением: `apps/web/public/branding/`.

## Windows: иконка для .bat-ярлыка

1. ПКМ по `.bat` → **Создать ярлык**.
2. ПКМ по ярлыку → **Свойства** → вкладка **Ярлык** → **Сменить значок…**
3. **Обзор…** → выбрать `branding/sellerbase.ico` → OK.

`.bat` напрямую иконку не поддерживает — менять можно только у `.lnk`-ярлыка.

## Регенерация

Источник: `apps/web/public/branding/icon.svg`. Скрипт: `scripts/build-icons.mjs`.

```bash
node scripts/build-icons.mjs
```

Рендерер выбирается автоматически: `sharp` → ImageMagick `convert` → Python (`cairosvg` + `Pillow`).
В CI/sandbox стандартно используется Python-фолбэк:

```bash
pip install Pillow cairosvg
node scripts/build-icons.mjs
```
