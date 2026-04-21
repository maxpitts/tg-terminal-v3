-- ============================================================
-- T&G Terminal — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Users (extends Supabase auth.users) ─────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  whop_user_id text unique,
  whop_membership_id text,
  display_name text,
  avatar_url text,
  plan text default 'free', -- 'free' | 'pro' | 'elite'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- ── Desktop State (persisted window positions, icon layout) ──
create table public.desktop_states (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  icon_positions jsonb default '{}'::jsonb,
  open_windows jsonb default '[]'::jsonb,
  settings jsonb default '{}'::jsonb, -- sfx_muted, theme, etc
  updated_at timestamptz default now()
);
alter table public.desktop_states enable row level security;
create policy "Users manage own desktop" on public.desktop_states for all using (auth.uid() = user_id);

-- ── HOT Signals History ───────────────────────────────────────
create table public.hot_signals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  ticker text not null,
  score integer not null,
  dp_notional numeric,
  dp_side text,
  dp_venue text,
  flow_type text,       -- CALL | PUT
  flow_side text,       -- SWEEP | BLOCK
  flow_premium numeric,
  flow_strike text,
  flow_expiry text,
  flow_dte integer,
  delta_minutes integer,
  fired_at timestamptz default now()
);
alter table public.hot_signals enable row level security;
create policy "Users view own signals" on public.hot_signals for select using (auth.uid() = user_id);
create policy "Service role insert signals" on public.hot_signals for insert with check (true);
create index hot_signals_user_fired on public.hot_signals(user_id, fired_at desc);
create index hot_signals_ticker on public.hot_signals(ticker, fired_at desc);

-- ── Trade Journal ─────────────────────────────────────────────
create table public.journal_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null default '',
  updated_at timestamptz default now()
);
alter table public.journal_entries enable row level security;
create policy "Users manage own journal" on public.journal_entries for all using (auth.uid() = user_id);

-- ── Trade Log ─────────────────────────────────────────────────
create table public.trades (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  ticker text not null,
  direction text not null,       -- LONG | SHORT
  entry_price numeric not null,
  exit_price numeric,
  size numeric not null,
  pnl numeric,
  pnl_pct numeric,
  notes text,
  opened_at timestamptz default now(),
  closed_at timestamptz,
  status text default 'open'     -- 'open' | 'closed'
);
alter table public.trades enable row level security;
create policy "Users manage own trades" on public.trades for all using (auth.uid() = user_id);

-- ── Watchlists ────────────────────────────────────────────────
create table public.watchlists (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null default 'My Watchlist',
  tickers text[] default '{}',
  created_at timestamptz default now()
);
alter table public.watchlists enable row level security;
create policy "Users manage own watchlists" on public.watchlists for all using (auth.uid() = user_id);

-- ── GammaFlow Signals (from TradingView webhook) ──────────────
create table public.gamma_signals (
  id uuid default uuid_generate_v4() primary key,
  ticker text not null,
  signal text not null,
  regime text not null,
  confidence integer,
  timeframe text,
  source text default 'tradingview',
  fired_at timestamptz default now()
);
-- Public read for all authenticated users (shared signal feed)
alter table public.gamma_signals enable row level security;
create policy "Authenticated users can read gamma signals" on public.gamma_signals for select using (auth.role() = 'authenticated');
create policy "Service role insert gamma signals" on public.gamma_signals for insert with check (true);
create index gamma_signals_fired on public.gamma_signals(fired_at desc);

-- ── Cached News (refreshed by cron) ──────────────────────────
create table public.news_cache (
  id uuid default uuid_generate_v4() primary key,
  headline text not null,
  category text,
  source text,
  url text,
  is_breaking boolean default false,
  published_at timestamptz,
  cached_at timestamptz default now()
);
alter table public.news_cache enable row level security;
create policy "Anyone can read news" on public.news_cache for select using (true);
create policy "Service role manages news" on public.news_cache for all with check (true);

-- ── Helper: auto-update updated_at ───────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger profiles_updated before update on public.profiles for each row execute function update_updated_at();
create trigger desktop_states_updated before update on public.desktop_states for each row execute function update_updated_at();
create trigger journal_updated before update on public.journal_entries for each row execute function update_updated_at();

-- ── New user trigger: create profile + desktop state ─────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.desktop_states (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
