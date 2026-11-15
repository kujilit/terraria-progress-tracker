# Development status

## UI and local mode
- [x] React + TypeScript + Vite interface
- [x] Overview, players, class progression, inventory, bosses, crafting tree and catalog
- [x] Local demo persistence
- [x] Local adapter and typed API contract

## Apps Script API v1
- [x] World creation and invite code
- [x] Join world and player PIN
- [x] PIN hashing with per-player salt and server-side pepper
- [x] 12-hour sessions, hashed session tokens and logout revocation
- [x] Login lockout after failed attempts
- [x] World-scoped player list and progress read/write
- [x] Boss status read/write
- [x] Inventory quantity read/write and locked transfers with idempotency key
- [x] Append-only audit records
- [x] Additive Sheets schema initialization
- [x] Browser remote API adapter and login/join/create screen
- [x] Progress and boss UI synchronization
- [x] Inventory quantity editor and transfer UI

## Not production-ready
- [ ] Owner must create Spreadsheet, set Script Properties, authorize and deploy Apps Script Web App
- [ ] Live browser CORS smoke test (Content Service redirect behavior)
- [ ] End-to-end multi-browser verification
- [ ] Inventory transfer rollback strategy for partial Sheets write failures
- [ ] Complete verified item/recipe/boss dataset for a pinned Terraria release
- [ ] PostgreSQL migration before larger/public usage
