-- Speed up daily per-match / per-voter rate count (see assertMatchDuelDailyLimit in app)
create index if not exists idx_battles_match_voter_created
  on public.battles (match_id, voter_ip_hash, created_at desc);
