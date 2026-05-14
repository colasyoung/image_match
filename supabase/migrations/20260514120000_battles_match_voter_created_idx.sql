-- Prerequisite: `public.battles` must exist (created by 20260514000000_init.sql or equivalent).
-- If you see "relation battles does not exist", run the init migration on this database first.
--
-- Speed up daily per-match / per-voter rate count (see assertMatchDuelDailyLimit in app)
create index if not exists idx_battles_match_voter_created
  on public.battles (match_id, voter_ip_hash, created_at desc);
