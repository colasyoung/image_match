-- Image Match MVP schema
-- Run in Supabase SQL editor or via CLI

create extension if not exists "pgcrypto";

do $$ begin
  create type match_status as enum ('draft', 'active', 'paused', 'ended');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  cover_image text,
  status match_status not null default 'draft',
  is_public boolean not null default true,
  allow_anonymous boolean not null default true,
  realtime_leaderboard boolean not null default true,
  show_rating_history boolean not null default true,
  created_ip_region text,
  creator_ip_hash text,
  manage_token text not null unique,
  vote_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  image_url text not null,
  thumb_url text,
  width integer,
  height integer,
  content_hash text,
  elo_rating double precision not null default 1200,
  battle_count integer not null default 0,
  win_count integer not null default 0,
  loss_count integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_images_match on public.images (match_id);

create table if not exists public.pair_encounters (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  image_a_id uuid not null references public.images (id) on delete cascade,
  image_b_id uuid not null references public.images (id) on delete cascade,
  encounter_count integer not null default 0,
  unique (match_id, image_a_id, image_b_id),
  constraint pair_order check (image_a_id < image_b_id)
);

create index if not exists idx_pair_encounters_match on public.pair_encounters (match_id);

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  left_image_id uuid not null references public.images (id) on delete cascade,
  right_image_id uuid not null references public.images (id) on delete cascade,
  winner_image_id uuid references public.images (id) on delete set null,
  loser_image_id uuid references public.images (id) on delete set null,
  voter_ip_hash text not null,
  voter_region text,
  skipped boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_battles_match_created on public.battles (match_id, created_at desc);
create index if not exists idx_battles_voter_recent on public.battles (voter_ip_hash, created_at desc);

create table if not exists public.rating_history (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.images (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  old_rating double precision not null,
  new_rating double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rating_history_image_time on public.rating_history (image_id, created_at desc);

create or replace function public.set_matches_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_matches_updated on public.matches;
create trigger trg_matches_updated
before update on public.matches
for each row execute function public.set_matches_updated_at();

-- Atomic vote + Elo update (service_role only)
create or replace function public.apply_match_vote(
  p_match_id uuid,
  p_winner_id uuid,
  p_loser_id uuid,
  p_left_id uuid,
  p_right_id uuid,
  p_voter_hash text,
  p_voter_region text,
  p_k double precision default 32
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rw double precision;
  rl double precision;
  ew double precision;
  new_rw double precision;
  new_rl double precision;
begin
  if p_winner_id = p_loser_id then
    raise exception 'invalid pair';
  end if;

  select elo_rating into rw
  from images
  where id = p_winner_id and match_id = p_match_id
  for update;

  select elo_rating into rl
  from images
  where id = p_loser_id and match_id = p_match_id
  for update;

  if rw is null or rl is null then
    raise exception 'images not found';
  end if;

  ew := 1::double precision / (1::double precision + power(10::double precision, (rl - rw) / 400::double precision));
  new_rw := rw + p_k * (1::double precision - ew);
  new_rl := rl + p_k * (0::double precision - (1::double precision - ew));

  insert into rating_history (image_id, match_id, old_rating, new_rating)
  values (p_winner_id, p_match_id, rw, new_rw);

  insert into rating_history (image_id, match_id, old_rating, new_rating)
  values (p_loser_id, p_match_id, rl, new_rl);

  update images
  set
    elo_rating = new_rw,
    battle_count = battle_count + 1,
    win_count = win_count + 1
  where id = p_winner_id;

  update images
  set
    elo_rating = new_rl,
    battle_count = battle_count + 1,
    loss_count = loss_count + 1
  where id = p_loser_id;

  insert into battles (
    match_id,
    left_image_id,
    right_image_id,
    winner_image_id,
    loser_image_id,
    voter_ip_hash,
    voter_region,
    skipped
  ) values (
    p_match_id,
    p_left_id,
    p_right_id,
    p_winner_id,
    p_loser_id,
    p_voter_hash,
    p_voter_region,
    false
  );

  update matches
  set vote_count = vote_count + 1
  where id = p_match_id;

  return jsonb_build_object(
    'ok', true,
    'winner_new_elo', new_rw,
    'loser_new_elo', new_rl
  );
end;
$$;

revoke all on function public.apply_match_vote(uuid, uuid, uuid, uuid, uuid, text, text, double precision) from public;
grant execute on function public.apply_match_vote(uuid, uuid, uuid, uuid, uuid, text, text, double precision) to service_role;

alter table public.matches enable row level security;
alter table public.images enable row level security;
alter table public.rating_history enable row level security;

drop policy if exists "matches_select_public" on public.matches;
create policy "matches_select_public"
on public.matches for select
using (status <> 'draft');

drop policy if exists "images_select_public" on public.images;
create policy "images_select_public"
on public.images for select
using (
  exists (
    select 1 from public.matches m
    where m.id = images.match_id and m.status <> 'draft'
  )
);

drop policy if exists "rating_history_select_public" on public.rating_history;
create policy "rating_history_select_public"
on public.rating_history for select
using (
  exists (
    select 1 from public.images i
    join public.matches m on m.id = i.match_id
    where i.id = rating_history.image_id
      and m.status <> 'draft'
      and m.show_rating_history = true
  )
);

-- Realtime (Supabase dashboard may also need toggles on tables)
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.images;
