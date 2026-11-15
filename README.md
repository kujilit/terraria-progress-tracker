# Terraria Progress Tracker

Веб-приложение для совместного отслеживания прохождения Terraria Vanilla. Стек: React + TypeScript + Vite. Есть локальный режим и удалённый Apps Script API v1.

## Запуск локально

Требуется Node.js 20+.

```bash
npm install
npm run dev
```

Сборка: `npm run build`.

## Режимы работы

По умолчанию используется локальный demo mode (localStorage). Для удалённого API:

1. Разверните Google Apps Script по инструкции [docs/API_V1.md](docs/API_V1.md).
2. Укажите в окружении frontend:
   ```dotenv
   VITE_API_MODE=remote
   VITE_API_BASE_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
   ```
3. Пересоберите и разверните frontend.

Не добавляйте `PIN_PEPPER` или другие серверные секреты в Vite env: всё с префиксом `VITE_` попадает в клиентский bundle.

## GitHub Pages

Workflow `.github/workflows/deploy.yml` собирает ветку `main`. В Settings → Pages выберите **GitHub Actions**. Для репозитория `terraria-progress-tracker` Vite base path настроен под `/terraria-progress-tracker/`.

## Важно

- Apps Script + Sheets — MVP для небольшой закрытой группы, не production база данных.
- Для удалённого режима каждый игрок входит по коду мира, имени и индивидуальному PIN (6–12 цифр).
- Каталог предметов, рецепты и часть этапов боссов пока демонстрационные. Не считайте их проверенными для Terraria 1.4.5.x.
- Перед использованием удалённого режима выполните smoke test из [docs/API_V1.md](docs/API_V1.md).
