# Terraria Progress Tracker

Веб-приложение для совместного отслеживания прохождения Terraria. Текущая версия — UI-прототип с локальным сохранением; серверная синхронизация ещё не включена.

## Запуск

Требуется Node.js 20+.

```bash
npm install
npm run dev
```

Сборка: `npm run build`.

## Стек

React + TypeScript + Vite. Интеграционный каркас Google Apps Script / Google Sheets находится в `apps-script/Code.gs`; API contract и требования безопасности — в `docs/INTEGRATION_PLAN.md`.

## Ограничения

Каталог предметов и рецепты демонстрационные и не верифицированы. Авторизация, серверный CRUD, синхронизация, инвентарные транзакции и автоматические тесты ещё не реализованы. Не используйте проект как production multiplayer tracker.
