-- Bomberpump profiles + progression.
-- Apply in the Supabase SQL editor (or via migration), then set on the server:
--   SUPABASE_URL=https://<project>.supabase.co
--   SUPABASE_SERVICE_KEY=<service_role key>
-- Only the server (service role) touches this table; RLS stays locked.

create table if not exists public.profiles (
  wallet         text primary key,
  name           text not null default '',
  skin           int  not null default 0,
  level          int  not null default 1,
  xp             bigint not null default 0,
  matches        int  not null default 0,
  wins           int  not null default 0,
  frags          int  not null default 0,
  deaths         int  not null default 0,
  current_streak int  not null default 0,
  best_streak    int  not null default 0,
  updated_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;
-- No policies: PostgREST anon/auth roles get nothing; the service_role key
-- (used only by the game server) bypasses RLS.

-- Atomic upsert + increment. xp delta is computed server-side and passed in,
-- so the XP formula lives in one place (the Node server).
create or replace function public.record_match(
  p_wallet text,
  p_name   text,
  p_skin   int,
  p_won    boolean,
  p_frags  int,
  p_deaths int,
  p_xp     int
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.profiles (wallet, name, skin, xp, matches, wins, frags, deaths,
                               current_streak, best_streak, level, updated_at)
  values (p_wallet, p_name, p_skin, p_xp, 1, case when p_won then 1 else 0 end,
          p_frags, p_deaths, case when p_won then 1 else 0 end,
          case when p_won then 1 else 0 end, 1 + (p_xp / 200), now())
  on conflict (wallet) do update set
    name = excluded.name,
    skin = excluded.skin,
    xp = public.profiles.xp + p_xp,
    matches = public.profiles.matches + 1,
    wins = public.profiles.wins + case when p_won then 1 else 0 end,
    frags = public.profiles.frags + p_frags,
    deaths = public.profiles.deaths + p_deaths,
    current_streak = case when p_won then public.profiles.current_streak + 1 else 0 end,
    best_streak = greatest(public.profiles.best_streak,
                           case when p_won then public.profiles.current_streak + 1 else 0 end),
    level = 1 + ((public.profiles.xp + p_xp) / 200),
    updated_at = now();
end;
$$;
