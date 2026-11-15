# Integration plan

## Current architecture

- React SPA with a local demo adapter and an Apps Script remote adapter.
- Google Apps Script API v1 for world lifecycle, authentication, progress, bosses and inventory.
- Google Sheets for MVP persistence.
- GitHub Actions for frontend type-check/build and Pages deployment.

## API modules

- `src/services/api.ts`: typed API contract and domain records.
- `src/services/local-api.ts`: browser-only local adapter.
- `src/services/apps-script-api.ts`: remote Apps Script HTTP adapter.
- `src/services/index.ts`: selects adapter through Vite environment variables.
- `apps-script/Code.gs`: authenticated server API and schema migrations.
- `apps-script/appsscript.json`: minimum spreadsheet scope.

See [API_V1.md](./API_V1.md) for deployment, payloads, security requirements and smoke tests.

## Security boundary

The server derives world/player identity from the session token. Client-supplied player IDs are not trusted for progress updates or transfers. PIN hashes use per-player salts and a server-side Script Property pepper; access tokens are random and only their hashes are persisted. Mutating operations use a script lock; inventory transfers also require idempotency keys and are recorded in an append-only audit table.

## Current limits

Apps Script + Sheets is suitable for a small private prototype, not for public/large-scale multiplayer. It has execution quotas, limited concurrency and no relational transaction guarantees. The script lock serializes this app's mutation paths but does not provide database transactions. If usage grows, preserve the API contract and replace Sheets with PostgreSQL/Supabase or Firestore.

Apps Script Content Service redirects responses to a one-time `script.googleusercontent.com` URL. The browser client follows redirects and sends a simple `text/plain` request to avoid preflight; a live CORS smoke test is still required. If the browser blocks the response, add Cloudflare Worker or Cloud Run as a proxy.

## Next implementation steps

1. Finish browser-level smoke tests after the owner deploys the Apps Script Web App.
2. Connect the inventory screen to live quantity records and transfer forms.
3. Add world administration (member removal, invite rotation, world settings).
4. Add automated contract tests and concurrency tests.
5. Replace sample item/boss/recipe data with a sourced, version-pinned dataset.
6. Evaluate PostgreSQL before adding more complex crafting reservations.
