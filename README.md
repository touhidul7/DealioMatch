# Dealio App

Dealio is a Next.js admin app for buyer/listing intake, normalization, dedupe review, weighted matching, and Google Sheets integration.

## Stack
- Next.js (App Router)
- React (JS/JSX)
- NextAuth (credentials auth)
- Supabase Postgres
- Google APIs (Sheets + Drive via OAuth)
- AI parsing providers: ChatGPT, Gemini, OpenRouter, OpenClaw-compatible

## Core Features
- Admin login and protected dashboard/pages/APIs
- Buyers and Listings table managers:
  - inline edit + delete
  - bulk activate/deactivate/delete
  - search + pagination
- Listings AI parser:
  - parses raw text via selected provider
  - saves one or many parsed listings in batch
- SOP-style match engine:
  - weighted scoring + thresholds
  - `matches` + `top_50_by_listing`
  - run metadata in `match_runs`
  - editable match weights in Settings
- Buyers raw ingestion pipeline:
  - `buyers_raw_imports` intake
  - processing into `buyers` master
  - status tracking (`pending/processed/failed/skipped`)
- Dedupe review pipeline:
  - generate duplicate cases in `buyers_dedupe_review`
  - approve/reject/merged statuses
  - apply-merge action merges two buyers and rewires related match rows
- Data IO:
  - CSV/XLSX import
  - CSV/XLSX export
- Google Sheets integration:
  - OAuth popup connect flow
  - spreadsheet + worksheet selectors for 3 SOP spreadsheets
  - export buyers/listings/matches/top50/match_settings
  - export `buyers_raw_imports` and `buyers_dedupe_review`
  - buyers sync from Sheets raw imports
- Advisor Drive automation:
  - map Drive folder IDs to advisor IDs/names in settings
  - sync CSV files from advisor folders
  - avoid re-importing with `advisor_file_imports` processed-file tracking

## SOP Spreadsheet/Tabs Supported
- `Dealio_Buyers_Master`
  - `buyers_raw_imports`
  - `buyers_master`
  - `buyers_dedupe_review`
- `Dealio_Listings_Master`
  - `listings_master`
- `Dealio_Matching_Engine`
  - `match_results`
  - `top_50_by_listing`
  - `match_settings`

## Setup
1. Copy `.env.example` to `.env` (or `.env.local` if you prefer local-only).
2. Configure required env values:
   - `NEXTAUTH_SECRET`
   - `APP_ADMIN_EMAIL`
   - `APP_ADMIN_PASSWORD`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
3. Configure optional integrations as needed:
   - GHL: `GHL_API_KEY`, `GHL_LOCATION_ID`
   - OpenAI: `OPENAI_API_KEY`
   - Gemini: `GEMINI_API_KEY`
   - OpenRouter: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
   - OpenClaw-compatible: endpoint/model/auth envs used by your deployment
   - Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (refresh token saved via OAuth popup)
4. Run `scripts/schema.sql` in Supabase SQL editor.
5. Install dependencies: `npm install`
6. Run dev server: `npm run dev`

## Vercel Deployment
1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import the project in Vercel.
3. In Vercel Project Settings -> Environment Variables, set:
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (your production URL, for example `https://your-app.vercel.app`)
   - `APP_ADMIN_EMAIL`
   - `APP_ADMIN_PASSWORD`
   - `SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL` (same value as `SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same value as `SUPABASE_ANON_KEY`)
4. Add optional integration env vars only if you use them:
   - Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
   - GHL: `GHL_API_KEY`, `GHL_LOCATION_ID`
   - OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`
   - Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`
   - OpenRouter: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_MODEL_FALLBACKS`, `OPENROUTER_API_URL`, `OPENROUTER_APP_NAME`, `OPENROUTER_MAX_RETRIES`
   - OpenClaw-compatible: `OPENCLAW_API_URL`, `OPENCLAW_API_KEY`
5. Run `scripts/schema.sql` in Supabase before first production run.
6. Redeploy after env var changes.

### Google OAuth Redirect URIs (Production)
In Google Cloud Console OAuth Client, add:
- `https://your-app.vercel.app/api/google-oauth/callback`
- (Optional preview) `https://<your-preview-domain>/api/google-oauth/callback`

### Notes for Vercel Functions
- Heavy API jobs in this project are pinned to Node runtime with longer `maxDuration` where needed.
- If you are on a Vercel plan with strict function limits, large sync jobs may still need batching.

## Important Endpoints
- `POST /api/providers` parse listing text
- `POST /api/match/run` run weighted matching
- `GET/PUT /api/match/settings` read/update match weights
- `POST /api/google-sheets/sync/buyers` sync buyers from Sheets raw imports
- `POST /api/google-sheets/export` export datasets to selected Sheets tabs
- `POST /api/google-drive/sync/advisors` ingest advisor CSVs from mapped Drive folders
- `POST /api/dedupe/buyers/run` build dedupe queue
- `POST /api/dedupe/buyers/apply-merge` merge approved duplicate buyers

## Settings Notes
- Google settings are saved in `integration_settings`.
- Advisor folder mapping uses `gsheets_advisor_folders_json` as JSON array:
```json
[
  {"folder_id":"<drive_folder_id>", "advisor_id":"ADV-001", "advisor_name":"Alex Morgan"}
]
```
- Reconnect Google account if shared spreadsheets are not visible after permission changes.

## Apps Script Note
- If you run sheet automation via Apps Script triggers only, you do not need Apps Script deployment.
- Deployment is only required for web app endpoints (`doGet`/`doPost`) or external callers.
