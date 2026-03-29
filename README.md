# Dealio App

A Next.js + React + NextAuth + Supabase app for syncing buyers from GHL, storing listings, parsing listing text with AI providers, and scoring buyer-listing matches with SOP-aligned weighted matching.

## Stack
- Next.js App Router
- React (JS/JSX)
- NextAuth credentials login
- Supabase Postgres
- GHL API sync
- Optional AI providers: ChatGPT, Gemini, OpenClaw-compatible endpoint

## Features
- Admin login with NextAuth credentials
- Dashboard with buyers, listings, matches, and sync logs
- GHL buyer sync endpoint
- Listings page with AI parser panel
- Match engine endpoint with weighted SOP scoring, ranking, buckets, explanations
- Dynamic match settings in `match_settings` table and settings UI
- `top_50_by_listing` output table + match run metadata (`match_runs`)
- Google Sheets integration settings panel (SOP tab selectors)
- Google Sheets buyer sync + buyer/listing/match export endpoints
- CSV/XLSX import + export for buyers, listings, and matches
- Supabase SQL schema included

## Setup
1. Copy `.env.example` to `.env.local`
2. Fill in your values:
   - `NEXTAUTH_SECRET`
   - `APP_ADMIN_EMAIL`
   - `APP_ADMIN_PASSWORD`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `GHL_API_KEY`
   - `GHL_LOCATION_ID`
   - optional provider keys for OpenAI, Gemini, OpenClaw
3. Run `scripts/schema.sql` in your Supabase SQL editor
4. Install dependencies with `npm install`
5. Start with `npm run dev`

## Notes
- Run the updated `scripts/schema.sql` in Supabase after pulling new changes.
- Matching settings are editable from `/settings` and used by `/api/match/run`.
- Google Sheets settings are editable in `/settings` and saved in `integration_settings`.
- Google auth supports service account or OAuth refresh-token mode.
- Settings page supports OAuth popup connect + spreadsheet/worksheet selection.
- For service account mode: Sheets API enabled + spreadsheet share to service account email.
- GHL field mapping may need adjustment based on your exact custom fields.
- OpenClaw support is implemented as a generic compatible HTTP provider endpoint; plug in your own endpoint and auth details.
