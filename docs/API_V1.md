# Apps Script API v1

## Deployment checklist

1. Create a Google Spreadsheet for the tracker.
2. Open [script.google.com](https://script.google.com), create a standalone Apps Script project and paste `apps-script/Code.gs` into `Code.gs`.
3. Add `appsscript.json` from this repository as the project manifest (enable **Show "appsscript.json" manifest file in editor settings** first).
4. Open Project Settings → Script Properties and add:
   - `SPREADSHEET_ID`: the ID between `/d/` and `/edit` in the spreadsheet URL.
   - `PIN_PEPPER`: a cryptographically random secret with at least 32 characters. Generate locally with Python: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Do not commit it or share it with players.
5. In the Apps Script editor, select `initializeSheets` and click Run. Approve the spreadsheet permission prompt. The function creates the tables and appends any missing columns without clearing existing data.
6. Deploy → New deployment → Web app:
   - Execute as: **Me** (the spreadsheet is accessed by the deployment owner).
   - Who has access: **Anyone** (anonymous access). Player authentication is handled by the API's world code + PIN. Use this only for a private group and keep the PIN pepper secret.
7. Copy the deployment URL ending in `/exec`. Do not use the editor test URL ending in `/dev` for normal players.
8. In the frontend environment, set:
   ```dotenv
   VITE_API_MODE=remote
   VITE_API_BASE_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
   ```
   Rebuild and redeploy the frontend after changing Vite environment variables.

## API routes

All writes and authenticated reads are POST requests with JSON body. Responses follow:

```json
{ "success": true, "data": {}, "error": null }
```

Errors follow:

```json
{ "success": false, "data": null, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

### Public routes

- `GET ?action=health`
- `POST { "action": "health" }`
- `POST { "action": "world.create", "worldName": "...", "playerName": "...", "pin": "123456", "gameClass": "Melee" }`
- `POST { "action": "world.join", "joinCode": "ABCDEFGH", "playerName": "...", "pin": "123456", "gameClass": "Ranger" }`
- `POST { "action": "auth.login", "joinCode": "ABCDEFGH", "playerName": "...", "pin": "123456" }`

The create/join/login responses include a bearer-like session token. The API stores only its SHA-256 hash in the Sessions sheet. The token is returned once and kept in browser session storage.

### Authenticated routes

Include `token` in the body:

- `auth.logout`
- `world.info`
- `players.list`
- `progress.list`
- `progress.set` with `itemId`, `status`, `quantity`
- `bosses.list`
- `boss.setStatus` with `bossId`, `status: "defeated" | "pending"`
- `inventory.list`
- `inventory.set` with `itemId`, `quantity`
- `inventory.transfer` with `toPlayerId`, `itemId`, `quantity`, `idempotencyKey`

The authenticated player ID and world ID are derived from the server-side session, never accepted from the client for progress writes or inventory transfers.

## Security model and limits

- PINs are HMAC-SHA256 hashes using per-player random salts and the private `PIN_PEPPER` Script Property. Raw PINs are never written to Sheets.
- Five failed PIN attempts lock that player membership for 15 minutes. Sessions expire after 12 hours and can be revoked by logout.
- Mutations use `LockService.getScriptLock()`; inventory transfers use an idempotency key and write an append-only audit trail.
- A world join code is a bearer invitation. Only share it with the group. Each player should use an individual PIN.
- The deployment is public because anonymous players need to call the API. Do not make the spreadsheet public.
- Apps Script + Sheets is an MVP, not a robust production backend. Apps Script has quotas and Sheets does not provide relational transactions. A script lock serializes this application's writes but does not turn Sheets into a full database.
- Content Service responses are redirected to a one-time `script.googleusercontent.com` URL. The browser adapter follows redirects and sends `text/plain` to avoid a CORS preflight; the actual browser origin/deployment behavior still needs a live smoke test. If browser CORS blocks the response, put a small Cloudflare Worker or Cloud Run proxy in front of Apps Script rather than disabling browser security.
- Do not enable transfers for valuable data or large groups until race/retry behavior has been tested with concurrent clients.

## Manual smoke test

After deploying the script:

1. Open `https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=health`; expect JSON with `status: "ok"`.
2. Create a test world from the app and record its 8-character join code.
3. Join from a second browser session with a different player name and PIN.
4. Mark an item and a boss from each session. Refresh both sessions and check the data in Sheets.
5. Add inventory quantities, transfer a portion to the second player, and retry the same request ID. The second attempt must return `duplicate: true`.
6. Enter an incorrect PIN five times and verify the temporary lock. Use a separate test membership when repeating this test.

The UI's API adapter is wired for world creation/join/login, player list, progress, bosses and inventory operations. The existing sample catalog is still demo data and must be verified against a pinned Terraria release before treating it as authoritative.
