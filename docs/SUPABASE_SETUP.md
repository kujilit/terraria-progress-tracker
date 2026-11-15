# Supabase Cloud setup

This is the remote backend for GitHub Pages. No local server, Docker, Apps Script deployment, or service-role key is required.

## 1. Create a Supabase project

1. Open [Supabase](https://supabase.com/dashboard) and create a project.
2. Choose a project name and a strong database password. Store the database password in your password manager; it is not needed by the frontend.
3. Choose a region close to the people who will use the tracker.
4. Wait until the project status is **Healthy**.

## 2. Create the database schema

1. Open the project in Supabase Dashboard.
2. Open **SQL Editor**.
3. Open `supabase/migrations/001_initial_schema.sql` in this repository.
4. Copy the entire file into a new SQL query and click **Run**.
5. Confirm the query completes without errors.

The migration creates the tracker tables, indexes and RPC functions. It enables Row Level Security and revokes direct access to the tables from the browser roles. The web app uses only the narrow RPC functions. PIN hashes are stored using bcrypt; raw PINs are not stored. Session tokens are random, expire after 12 hours, and only their SHA-256 hashes are stored.

## 3. Get the frontend connection values

In the Supabase Dashboard, open **Connect** or **Project Settings → API Keys** and copy:

- **Project URL**, for example `https://abcdefgh.supabase.co`
- **Publishable key**, normally starting with `sb_publishable_`

Some existing projects may show the legacy `anon` key instead. That key can also be used as the public client key. Do not use the `sb_secret_` key or legacy `service_role` key in the website. Publishable/anon keys are intended for browser clients and are restricted by database grants and Row Level Security. Secret/service-role keys bypass those protections.

## 4. Connect GitHub Pages

In this repository, open **Settings → Secrets and variables → Actions → Variables** and create these three repository variables:

| Name | Value |
|---|---|
| `VITE_API_MODE` | `remote` |
| `VITE_SUPABASE_URL` | Project URL from step 3 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key from step 3 |

These are **Variables**, not Secrets: the publishable key is designed to be included in the public browser bundle. Never add a secret/service-role key here.

After the variables are saved, open **Actions → Deploy to GitHub Pages → Run workflow** on the `main` branch. The build reads these variables and publishes the remote-mode frontend.

## 5. Smoke test

1. Open the published GitHub Pages site in a private/incognito window.
2. Create a test world and save the 8-character world code.
3. Open the site in another browser/private window and join the same world using a different player name, class and PIN.
4. Mark an item, update a boss and add an inventory quantity.
5. Reload the other browser and confirm the shared data is present.
6. Transfer part of an inventory stack and verify that the sender and receiver quantities both changed.

Use a test world before entering a real group's progress. Never send database passwords, secret keys or service-role keys in chat.

## Architecture and security

- **Frontend:** React/Vite on GitHub Pages.
- **Database/API:** Supabase PostgreSQL and PostgREST RPC.
- **Authentication:** world code + player name + individual 6–12 digit PIN. Five failed PIN checks lock that player for 15 minutes.
- **Authorization:** the API resolves the active player and world from the session token. The browser cannot choose an arbitrary player ID for progress writes or transfers.
- **Inventory transfers:** executed inside one PostgreSQL transaction, guarded by an idempotency key. A failed transfer rolls back all its database changes.
- **Browser key:** only the publishable key is used. Table access is revoked for `anon` and `authenticated`; RLS is enabled, and only the RPC methods are granted.

The app currently refreshes server data when the session loads and after local operations. It does not yet use Supabase Realtime push notifications, so another player's changes may require a page refresh to appear in an already-open tab.
