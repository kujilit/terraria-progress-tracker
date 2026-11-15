# Integration plan

## Current boundary

The UI currently runs in local demo mode. `src/services/api.ts` defines the transport contract and `src/services/local-api.ts` is the local adapter. No remote credentials are embedded in the browser bundle.

## Target architecture

- React SPA: presentation, forms, optimistic state, API client.
- Google Sheets: prototype persistence only; not a secure transactional database.
- Google Apps Script: server-side validation, authentication, authorization, audit log, and spreadsheet access.
- Optional Cloudflare Worker / Cloud Run proxy: recommended if browser CORS, rate limiting, or stronger session handling is needed.

## API contract (v1)

All responses use `{ success, data, error }`.

- `GET ?action=health`
- `POST action=auth.login` — world code, player id, PIN; returns short-lived session token.
- `POST action=world.create`
- `POST action=world.join`
- `POST action=progress.list`
- `POST action=progress.set`
- `POST action=inventory.transfer`
- `POST action=crafting.reserve`
- `POST action=boss.setStatus`

Every write must validate the session server-side, validate membership/role, validate IDs and quantities, and append an audit record. Never trust `playerId`, role, item ownership, or quantity supplied by the client without checking them against the authenticated session and current sheet state.

## Security requirements

1. Store PINs as salted hashes; never store raw PINs.
2. Generate random session tokens server-side and store only token hashes. Set a short expiry and revoke on logout.
3. Add rate limiting / lockout for failed PIN attempts. Apps Script alone has limited options; use a proxy for robust IP/device throttling.
4. Validate every action with allowlists and strict numeric bounds.
5. Use a Script Lock around inventory transfers, crafting reservations, and any read-modify-write operation to prevent lost updates.
6. Use idempotency keys for transfer and crafting commands to prevent duplicate application on retries.
7. Keep an append-only audit log for every mutation.
8. Do not expose the spreadsheet directly to players. Do not put service credentials in Vite environment variables.

## Spreadsheet limitations

Google Sheets is acceptable for a small private prototype, but it is not a relational database. Concurrent writes, quotas, lookup performance, and transaction semantics become limiting. For a production multi-user app, prefer PostgreSQL (e.g. Supabase/Neon) or Firestore. Keep the API contract stable so the persistence adapter can be replaced later.

## Rollout sequence

1. Push the UI scaffold.
2. Deploy Apps Script as a private/test web app and validate redirect/CORS behavior from the intended frontend host.
3. Implement login and session validation before enabling any write endpoints.
4. Implement progress read/write and connect the UI adapter.
5. Implement inventory transfer/reservation under locks and idempotency keys.
6. Add tests for authorization, duplicate requests, race conditions, and malformed payloads.
7. Import a sourced, version-pinned Terraria item/recipe/boss dataset; do not treat the current sample data as verified.
