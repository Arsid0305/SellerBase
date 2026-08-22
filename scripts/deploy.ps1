# Ручной деплой фронта SellerBase на Vercel.
#
# ВАЖНО: файл сохранён в UTF-8 с BOM. Windows PowerShell 5.1 без BOM читает
# .ps1 как ANSI, русский текст превращается в кашу и ломает разбор строк.
# Если правите файл - сохраняйте с BOM.
#
# Зачем скрипт. С 26.06.2026 автодеплой не работает: аккаунт GitHub Arsid0305
# под флагом T&S (тикет #4535795), из-за него отключены Actions, интеграция
# Vercel с GitHub и Supabase GitHub Integration. Подробности -
# AI_OS/MEMORY/tasks/cross-repo-todo.md и llm_wiki/wiki/workflow.md.
# В Kino-app та же проблема решена таким же скриптом.
#
# Запуск из корня репозитория:
#   powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
#
# Первый запуск потребует входа в Vercel CLI. Входить по email,
# а не через GitHub - OAuth-приложения GitHub заблокированы флагом.
#   vercel login   ->   выбрать "Continue with Email"

$ErrorActionPreference = 'Stop'

$ProjectId = 'prj_bwW6MnAXI8UwdDHKC6NrhXSWJZOG'
$OrgId     = 'team_rJZtkY8YbgEm1Lj2K4P39rkh'

function Step($text) { Write-Host "" ; Write-Host "=== $text ===" -ForegroundColor Cyan }
function Ok($text)   { Write-Host "  $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  $text" -ForegroundColor Yellow }

# Скрипт лежит в scripts/, значит корень репозитория на уровень выше.
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
Ok "Корень репозитория: $RepoRoot"

Step 'Проверка инструментов'
foreach ($tool in @('node', 'pnpm', 'git')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Не найден $tool. Установите его и повторите."
    }
    Ok "$tool на месте"
}
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Warn 'Vercel CLI не найден, ставлю глобально...'
    npm install -g vercel
}
Ok 'vercel CLI на месте'

Step 'Свежий main'
git fetch origin main
$current = (git rev-parse --abbrev-ref HEAD).Trim()
if ($current -ne 'main') {
    Warn "Текущая ветка $current, а деплоим main. Переключаюсь."
    git checkout main
}
git pull origin main
Ok "HEAD: $((git log --oneline -1).Trim())"

Step 'Зависимости'
pnpm install --frozen-lockfile

Step 'Проверки перед сборкой'
# Ловим ошибки локально: неудачная сборка на Vercel стоит дольше.
pnpm --filter @sellerbase/web typecheck
Ok 'типы чистые'
pnpm --filter @sellerbase/web lint
Ok 'линт чистый'

Step 'Привязка к проекту Vercel'
# Связь с GitHub оборвана, поэтому проект указываем явно -
# иначе CLI спросит интерактивно и не найдёт репозиторий.
New-Item -ItemType Directory -Force -Path '.vercel' | Out-Null
@{ projectId = $ProjectId; orgId = $OrgId } | ConvertTo-Json | Set-Content -Path '.vercel/project.json' -Encoding utf8
Ok 'проект seller-base-web'

Step 'Переменные окружения из Vercel'
# Нужны для сборки: ключи Supabase и прочее лежат в настройках проекта.
vercel pull --yes --environment=production
Ok 'переменные получены'

Step 'Сборка'
vercel build --prod

Step 'Выкатка в продакшн'
vercel deploy --prebuilt --prod

Write-Host ""
Write-Host "Готово. Проверьте https://seller-base-web.vercel.app" -ForegroundColor Green
Write-Host "Если появилась вкладка SEO карточек - деплой доехал." -ForegroundColor Green
