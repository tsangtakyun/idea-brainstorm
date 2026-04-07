create extension if not exists pgcrypto;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  business_type text not null default '',
  city text not null default '',
  country text not null default 'HK',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  bio text not null default '',
  base_city text not null default '',
  service_areas jsonb not null default '[]'::jsonb,
  languages jsonb not null default '[]'::jsonb,
  niches jsonb not null default '[]'::jsonb,
  platforms jsonb not null default '[]'::jsonb,
  pricing_notes text not null default '',
  min_rate numeric,
  portfolio_links jsonb not null default '[]'::jsonb,
  style_summary text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete set null,
  title text not null,
  vertical text not null default '',
  brand_name text not null default '',
  campaign_type text not null default '',
  objective text not null default '',
  target_platforms jsonb not null default '[]'::jsonb,
  budget_min numeric,
  budget_max numeric,
  location_text text not null default '',
  deadline_at timestamptz,
  status text not null default 'submitted',
  source_channel text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_briefs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  raw_brief text not null default '',
  business_context text not null default '',
  product_or_place text not null default '',
  key_selling_points jsonb not null default '[]'::jsonb,
  must_include jsonb not null default '[]'::jsonb,
  target_audience text not null default '',
  tone text not null default '',
  content_angle_suggestions jsonb not null default '[]'::jsonb,
  ai_summary text not null default '',
  ai_risk_flags jsonb not null default '[]'::jsonb,
  ops_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_matches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  match_score numeric not null default 0,
  match_reason text not null default '',
  status text not null default 'suggested',
  invited_at timestamptz,
  responded_at timestamptz,
  agreed_rate numeric,
  commission_model text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid references public.creator_profiles(id) on delete set null,
  source_type text not null default 'ai',
  draft_text text not null default '',
  qc_text text not null default '',
  tone_profile text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.storyboards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_id uuid references public.scripts(id) on delete set null,
  opening_notes text not null default '',
  background_notes text not null default '',
  transition_notes text not null default '',
  main_notes text not null default '',
  ending_notes text not null default '',
  shot_plan jsonb not null default '[]'::jsonb,
  production_notes text not null default '',
  export_url text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid references public.creator_profiles(id) on delete set null,
  deliverable_type text not null default '',
  file_url text not null default '',
  thumbnail_url text not null default '',
  caption_text text not null default '',
  status text not null default 'draft_uploaded',
  submitted_at timestamptz,
  approved_at timestamptz
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid references public.creator_profiles(id) on delete set null,
  merchant_total_amount numeric,
  creator_amount numeric,
  platform_amount numeric,
  commission_type text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  actor_type text not null default '',
  actor_id uuid,
  event_type text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
