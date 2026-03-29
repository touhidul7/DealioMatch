create extension if not exists pgcrypto;

create table if not exists buyers (
  id uuid primary key default gen_random_uuid(),
  ghl_contact_id text unique,
  first_name text,
  last_name text,
  full_name text,
  email text,
  normalized_email text,
  phone text,
  normalized_phone text,
  company text,
  city text,
  state_province text,
  country text,
  geo_normalized text,
  industry_interest_raw text,
  normalized_industries text,
  acquisition_criteria_raw text,
  normalized_keywords text,
  geographic_focus_raw text,
  normalized_geographies text,
  deal_size_min numeric,
  deal_size_max numeric,
  revenue_min numeric,
  revenue_max numeric,
  ebitda_min numeric,
  ebitda_max numeric,
  capital_available numeric,
  last_contact_date timestamptz,
  tags text,
  notes text,
  source_subaccount_id text,
  source_file_names text,
  source_advisor_ids text,
  source_advisor_names text,
  source_of_funds text,
  freshness_score integer,
  email_dedupe_key text,
  phone_dedupe_key text,
  name_company_dedupe_key text,
  manual_review_flag boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table buyers add column if not exists source_file_names text;
alter table buyers add column if not exists source_advisor_ids text;
alter table buyers add column if not exists source_advisor_names text;
alter table buyers add column if not exists source_of_funds text;
alter table buyers add column if not exists freshness_score integer;
alter table buyers add column if not exists email_dedupe_key text;
alter table buyers add column if not exists phone_dedupe_key text;
alter table buyers add column if not exists name_company_dedupe_key text;
alter table buyers add column if not exists manual_review_flag boolean default false;

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  listing_title text not null,
  company_name text,
  source_site text,
  source_url text,
  source_listing_key text,
  industry text,
  sub_industry text,
  industry_normalized text,
  keywords_normalized text,
  city text,
  state_province text,
  country text,
  geo_normalized text,
  asking_price numeric,
  revenue numeric,
  ebitda numeric,
  sde_cash_flow numeric,
  employees integer,
  established_year integer,
  inventory_included text,
  real_estate_included text,
  reason_for_sale text,
  summary text,
  listing_status text default 'active',
  listing_dedupe_key text,
  manual_review_flag boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table listings add column if not exists listing_dedupe_key text;
alter table listings add column if not exists manual_review_flag boolean default false;

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  match_run_id text,
  match_date timestamptz,
  listing_id uuid references listings(id) on delete cascade,
  buyer_id uuid references buyers(id) on delete cascade,
  listing_title text,
  buyer_name text,
  buyer_company text,
  buyer_email text,
  buyer_phone text,
  overall_score integer,
  industry_score integer,
  geo_score integer,
  size_score integer,
  revenue_score integer,
  ebitda_score integer,
  keyword_score integer,
  freshness_score integer,
  rank_for_listing integer,
  rank_for_buyer integer,
  match_bucket text,
  explanation text,
  created_at timestamptz default now()
);

alter table matches add column if not exists match_run_id text;
alter table matches add column if not exists match_date timestamptz;
alter table matches add column if not exists rank_for_buyer integer;

create table if not exists top_50_by_listing (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade,
  listing_title text,
  buyer_rank integer,
  buyer_id uuid references buyers(id) on delete cascade,
  buyer_name text,
  buyer_company text,
  buyer_email text,
  buyer_phone text,
  overall_score integer,
  industry_score integer,
  geo_score integer,
  size_score integer,
  keyword_score integer,
  explanation text,
  generated_at timestamptz default now()
);

create table if not exists match_settings (
  setting_name text primary key,
  setting_value numeric not null
);

insert into match_settings (setting_name, setting_value) values
  ('industry_weight', 0.35),
  ('geo_weight', 0.20),
  ('size_weight', 0.20),
  ('keyword_weight', 0.10),
  ('revenue_weight', 0.05),
  ('ebitda_weight', 0.05),
  ('freshness_weight', 0.05),
  ('min_match_threshold', 55),
  ('max_matches_per_listing', 50)
on conflict (setting_name) do nothing;

create table if not exists match_runs (
  id uuid primary key default gen_random_uuid(),
  match_run_id text unique not null,
  match_date timestamptz not null,
  listing_count integer default 0,
  buyer_count integer default 0,
  result_count integer default 0,
  threshold_used numeric,
  max_matches_per_listing_used numeric,
  created_at timestamptz default now()
);

create table if not exists integration_settings (
  setting_name text primary key,
  setting_value text,
  updated_at timestamptz default now()
);

create table if not exists buyers_raw_imports (
  id uuid primary key default gen_random_uuid(),
  raw_import_id text,
  import_batch_id text,
  source_file_name text,
  source_advisor_id text,
  source_advisor_name text,
  imported_at timestamptz default now(),
  raw_first_name text,
  raw_last_name text,
  raw_full_name text,
  raw_email text,
  raw_phone text,
  raw_company text,
  raw_city text,
  raw_state text,
  raw_country text,
  raw_tags text,
  raw_notes text,
  raw_acquisition_criteria text,
  raw_industry_interest text,
  raw_geographic_focus text,
  raw_deal_size text,
  raw_capital_available text,
  raw_last_contact_date text,
  raw_custom_fields_json text,
  processing_status text default 'pending',
  processing_notes text
);

create table if not exists buyers_dedupe_review (
  id uuid primary key default gen_random_uuid(),
  dedupe_case_id text,
  candidate_buyer_id_1 uuid references buyers(id) on delete cascade,
  candidate_buyer_id_2 uuid references buyers(id) on delete cascade,
  similarity_reason text,
  similarity_score numeric,
  suggested_action text,
  reviewer_status text default 'pending',
  reviewer_notes text,
  reviewed_at timestamptz
);

create table if not exists sync_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null,
  message text,
  created_at timestamptz default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists buyers_set_updated_at on buyers;
create trigger buyers_set_updated_at before update on buyers
for each row execute function set_updated_at();

drop trigger if exists listings_set_updated_at on listings;
create trigger listings_set_updated_at before update on listings
for each row execute function set_updated_at();

drop trigger if exists integration_settings_set_updated_at on integration_settings;
create trigger integration_settings_set_updated_at before update on integration_settings
for each row execute function set_updated_at();
