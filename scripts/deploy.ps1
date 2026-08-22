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

$ProjectName = 'seller-base-web'
$Scope       = 'arsid'

function Step($text) { Write-Host "" ; Write-Host "=== $text ===" -ForegroundColor Cyan }

# Внешние команды (git, pnpm, vercel) не бросают исключение при ошибке -
# ErrorActionPreference на них не действует. Без явной проверки $LASTEXITCODE
# скрипт шёл дальше после падения и рапортовал успех. Так и вышло на первом
# запуске: vercel pull подавился, а скрипт написал "переменные получены".
function Run($file, $arguments) {
    & $file @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Команда '$file $($arguments -join ' ')' завершилась с кодом $LASTEXITCODE"
    }
}
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
Run 'git' @('fetch', 'origin', 'main')
$current = (git rev-parse --abbrev-ref HEAD).Trim()
if ($current -ne 'main') {
    Warn "Текущая ветка $current, а деплоим main. Переключаюсь."
    Run 'git' @('checkout', 'main')
}
Run 'git' @('pull', 'origin', 'main')
Ok "HEAD: $((git log --oneline -1).Trim())"

Step 'Зависимости'
Run 'pnpm' @('install', '--frozen-lockfile')

Step 'Проверки перед сборкой'
# Ловим ошибки локально: неудачная сборка на Vercel стоит дольше.
Run 'pnpm' @('--filter', '@sellerbase/web', 'typecheck')
Ok 'типы чистые'
Run 'pnpm' @('--filter', '@sellerbase/web', 'lint')
Ok 'линт чистый'

Step 'Привязка к проекту Vercel'
# Раньше здесь писался .vercel/project.json вручную - и это ломало деплой:
# PowerShell 5.1 при -Encoding utf8 добавляет BOM, а CLI такой файл
# не переваривает ("Project Settings could not be retrieved").
# Пусть CLI создаёт файл сам - он знает формат.
if (Test-Path '.vercel') { Remove-Item -Recurse -Force '.vercel' }
Run 'vercel' @('link', '--yes', '--project', $ProjectName, '--scope', $Scope)
Ok "проект $ProjectName"

Step 'Выкатка в продакшн'
# Собираем НЕ локально, а на стороне Vercel - как он делал бы из GitHub.
#
# Почему не 'vercel build' + 'deploy --prebuilt': на Windows локальная
# сборка кладёт вывод так, что загрузчик его не находит -
# 'ENOENT: no such file or directory ... functions/analytics/margin.func'.
# Плюс standalone-раскладка упиралась в запрет симлинков.
# Удалённая сборка обходит обе беды: наверх уходят исходники,
# собирает их Linux-окружение Vercel.
Run 'vercel' @('deploy', '--prod', '--yes')

Write-Host ""
Write-Host "Готово. Проверьте https://seller-base-web.vercel.app" -ForegroundColor Green
Write-Host "Если появилась вкладка SEO карточек - деплой доехал." -ForegroundColor Green
