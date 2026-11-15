# Terraria Progress Tracker

Веб-приложение для совместного отслеживания прохождения Terraria Vanilla. Стек: React + TypeScript + Vite. Есть локальный demo mode и удалённый backend на Supabase Cloud.

## Запуск локально

Требуется Node.js 20+.

```bash
npm install
npm run dev
```

Сборка: `npm run build`.

## Режимы работы

По умолчанию используется локальный demo mode (localStorage). Для совместной работы включается Supabase:

1. Создай проект Supabase Cloud.
2. Выполни SQL-миграцию `supabase/migrations/001_initial_schema.sql` в Supabase SQL Editor.
3. Возьми Project URL и Publishable key в Supabase Dashboard.
4. Добавь GitHub Actions Variables: `VITE_API_MODE=remote`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Повторно запусти workflow **Deploy to GitHub Pages**. Значения Actions Variables подставляются во время сборки; простого сохранения переменных недостаточно для обновления уже опубликованного сайта.

Подробная инструкция: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

В браузере используется только публичный Publishable key. Не добавляй `sb_secret_*` или `service_role` в `VITE_*`, GitHub Actions Variables или исходный код. Секретные ключи обходят RLS и для этой архитектуры не нужны.

## GitHub Pages

Workflow `.github/workflows/deploy.yml` собирает ветку `main`. В Settings → Pages выбери **GitHub Actions**. Для репозитория `terraria-progress-tracker` Vite base path настроен под `/terraria-progress-tracker/`.

## Данные и ограничения

- Supabase PostgreSQL хранит миры, игроков, прогресс предметов, боссов и инвентарь.
- PIN сохраняется как bcrypt-хеш; после пяти неправильных попыток вход блокируется на 15 минут.
- Сессионный токен случайный, действует 12 часов; в базе хранится только его SHA-256-хеш.
- Передачи предметов выполняются атомарно в одной транзакции PostgreSQL и защищены idempotency key.
- Состояние других игроков обновляется в открытой вкладке с интервалом 10 секунд.
- Каталог предметов, рецепты и часть этапов боссов пока демонстрационные. Не считай их проверенными для Terraria 1.4.5.x.
- `apps-script/` и `docs/API_V1.md` оставлены в репозитории как прежний прототип; для текущего remote mode они не используются.
